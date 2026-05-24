'use server'

import { getOpenAIClient } from '@/lib/openai'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { assertUserOwnership, aiContextHeader } from '@/lib/ai-guard'

const MIN_ENTRIES_FOR_INSIGHT        = 3   // need at least this many entries
const MIN_ENTRIES_FOR_RECOMMENDATION = 10  // need this many before ever suggesting action

const INSIGHT_SCHEMA = {
  type: 'object',
  properties: {
    insight_text: {
      type: 'string',
      description:
        'A single profound, specific insight about this person derived from patterns across their stories. ' +
        '2–4 sentences. Must be non-obvious — something they could not easily see themselves. ' +
        'Written with warmth and precision, as a brilliant therapist or biographer would say it.',
    },
    recommendation: {
      type: ['string', 'null'],
      description:
        'A concrete, actionable suggestion arising directly from the insight. ' +
        'Only present when there are 10+ entries, the pattern is clearly actionable, ' +
        'and the suggestion touches nothing sensitive (grief, mortality, regret, faith, beliefs). ' +
        'Under 40 words. If in any doubt, return null.',
    },
    pattern_sources: {
      type: 'array',
      items: { type: 'string' },
      description: 'The domains or themes this insight draws from (e.g. ["childhood", "career"]).',
    },
  },
  required: ['insight_text', 'recommendation', 'pattern_sources'],
  additionalProperties: false,
}

export async function getOrCreateTodaysInsight(): Promise<{
  insight: {
    insight_text: string
    recommendation: string | null
    pattern_sources: string[]
  } | null
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { insight: null }

    const today = new Date().toISOString().slice(0, 10)

    // Return existing insight if already generated today
    const { data: existing } = await supabase
      .from('daily_insights')
      .select('insight_text, recommendation, pattern_sources')
      .eq('user_id', user.id)
      .eq('delivered_date', today)
      .single()

    if (existing) {
      return {
        insight: {
          insight_text: existing.insight_text,
          recommendation: existing.recommendation,
          pattern_sources: existing.pattern_sources,
        },
      }
    }

    const service = createServiceClient()

    // Gather data in parallel
    const [profileResult, entriesResult, previousInsightsResult] = await Promise.all([
      supabase.from('users')
        .select('display_name, legal_name, dob, relationship_status, location, life_description')
        .eq('id', user.id)
        .single(),
      supabase.from('soul_entries')
        .select('domain, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      service.from('daily_insights')
        .select('insight_text, pattern_sources')
        .eq('user_id', user.id)
        .order('delivered_date', { ascending: false })
        .limit(60),
    ])

    const entries = (entriesResult.data ?? []) as { user_id: string; domain: string; content: string; created_at: string }[]
    const profile = profileResult.data as Record<string, string | null> | null
    const previousInsights = (previousInsightsResult.data ?? []) as { user_id: string; insight_text: string; pattern_sources: string[] }[]

    // ── Layer 4 guard: assert ownership before any data enters the AI context ──
    // The service client bypasses RLS; we verify ownership explicitly here.
    assertUserOwnership(previousInsights, user.id, 'daily-insight/previousInsights')
    assertUserOwnership(entries,          user.id, 'daily-insight/entries')

    // Not enough data yet
    if (entries.length < MIN_ENTRIES_FOR_INSIGHT) {
      return { insight: null }
    }

    const canRecommend = entries.length >= MIN_ENTRIES_FOR_RECOMMENDATION

    // Build entry summary — never include biggest_regret or life_purpose directly
    const entrySummary = entries
      .slice(0, 40)
      .map((e) => `[${e.domain}] "${e.content.slice(0, 250)}${e.content.length > 250 ? '…' : ''}"`)
      .join('\n')

    const previousInsightList = previousInsights.length > 0
      ? '\n\n## PREVIOUS INSIGHTS (never repeat or rephrase these)\n' +
        previousInsights.map((p, i) => `${i + 1}. "${p.insight_text}"`).join('\n')
      : ''

    const previousPatterns = previousInsights.flatMap((p) => p.pattern_sources ?? [])
    const overusedPatterns = [...new Set(previousPatterns)].filter(
      (p) => previousPatterns.filter((x) => x === p).length >= 3,
    )

    const age = profile?.dob
      ? Math.floor((Date.now() - new Date(profile.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
      : null

    const profileContext = [
      profile?.display_name ?? profile?.legal_name ? `Name: ${profile?.display_name ?? profile?.legal_name}` : '',
      age ? `Age: ${age}` : '',
      profile?.relationship_status ? `Relationship: ${profile.relationship_status}` : '',
      profile?.location ? `Location: ${profile.location}` : '',
      profile?.life_description ? `Life in their own words: "${profile.life_description}"` : '',
    ].filter(Boolean).join('\n')

    const systemPrompt = `You are a deeply perceptive psychologist, philosopher, and biographer synthesizing someone's life story from the fragments they have shared.

## THE PERSON
${profileContext}

## YOUR MISSION
Find ONE profound, non-obvious pattern or theme running through their stories — a common denominator they themselves could not easily see. This is the "forest for the trees" insight: the thing an outside observer with deep human understanding would recognize that the person living it would miss.

Your insight must:
- Connect MULTIPLE stories from DIFFERENT domains
- Name something real and specific (not generic praise or platitudes)
- Feel revelatory, not obvious
- Be stated as a single observation, with warmth and precision
- Sound like something a brilliant therapist, editor, or wise mentor would say after reading their journal

## RECOMMENDATION RULES
${canRecommend
  ? '- ONLY include a recommendation if the pattern is clearly and directly actionable\n- NEVER recommend anything touching grief, mortality, faith, beliefs, or sensitive personal pain\n- If in any doubt at all, set recommendation to null'
  : '- Set recommendation to null — insufficient data for responsible suggestions yet'}

## WHAT TO AVOID
- Generic life wisdom ("cherish the present", "be kind")
- Flattery disguised as insight
- Repeating or restating anything from previous insights
- Insights that could feel presumptuous, clinical, or overreaching
- Patterns already heavily covered: ${overusedPatterns.length > 0 ? overusedPatterns.join(', ') : 'none yet'}

## THEIR STORIES
${entrySummary}
${previousInsightList}`

    const client = getOpenAIClient()

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.85,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'daily_insight',
          strict: true,
          schema: INSIGHT_SCHEMA,
        },
      },
      messages: [
        // aiContextHeader binds user_id at the prompt level (layer 5 isolation)
        { role: 'system', content: aiContextHeader(user.id) + systemPrompt },
        { role: 'user',   content: 'Generate today\'s insight.' },
      ],
    })

    const raw = response.choices[0]?.message?.content
    if (!raw) return { insight: null }

    const result = JSON.parse(raw) as {
      insight_text: string
      recommendation: string | null
      pattern_sources: string[]
    }

    // Persist via service role
    await service.from('daily_insights').upsert(
      {
        user_id: user.id,
        insight_text: result.insight_text,
        recommendation: result.recommendation ?? null,
        pattern_sources: result.pattern_sources,
        delivered_date: today,
      },
      { onConflict: 'user_id,delivered_date', ignoreDuplicates: false },
    )

    return { insight: result }
  } catch (err) {
    console.error('[daily-insight] generation failed:', err)
    return { insight: null }
  }
}
