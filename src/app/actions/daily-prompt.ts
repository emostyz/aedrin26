'use server'

import { getOpenAIClient } from '@/lib/openai'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { Domain } from '@/lib/supabase/types'

const DOMAINS: Domain[] = [
  'childhood', 'family', 'career', 'values', 'beliefs', 'lessons', 'messages',
]

const DOMAIN_DESCRIPTIONS: Record<Domain, string> = {
  childhood:  'early memories, home life, the texture of growing up',
  family:     'parents, siblings, family dynamics, traditions, things unsaid',
  career:     'professional identity, work that mattered, failures and what they cost',
  values:     'core beliefs, principles tested, what changed your mind',
  beliefs:    'mortality, faith, spirituality, philosophy, how you treat people',
  lessons:    'wisdom earned, mistakes, advice to pass forward',
  messages:   'things you want to say to the people who will miss you most',
  other:      'personal reflections',
}

interface DailyPromptResult {
  prompt_text: string
  domain: Domain
  rationale: string
}

const PROMPT_SCHEMA = {
  type: 'object',
  properties: {
    prompt_text: {
      type: 'string',
      description: 'The single reflection question to ask. Under 60 words. Open-ended, deeply personal, specific to this person.',
    },
    domain: {
      type: 'string',
      enum: DOMAINS,
      description: 'Which life domain this prompt explores.',
    },
    rationale: {
      type: 'string',
      description: 'One sentence explaining why this specific question was chosen for this person today. Internal only, never shown.',
    },
  },
  required: ['prompt_text', 'domain', 'rationale'],
  additionalProperties: false,
}

function buildSystemPrompt(profile: Record<string, string | null>): string {
  const age = profile.dob
    ? Math.floor((Date.now() - new Date(profile.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null

  const lines: string[] = [
    'You are the world\'s most thoughtful life-story interviewer. Your single job is to generate ONE perfect reflection question for a specific person.',
    '',
    '## THE PERSON',
    `Name: ${profile.display_name ?? profile.legal_name ?? 'Unknown'}`,
    age ? `Age: ${age}` : '',
    profile.relationship_status ? `Relationship status: ${profile.relationship_status}` : '',
    profile.location ? `Lives in: ${profile.location}` : '',
    profile.life_description ? `About their life: "${profile.life_description}"` : '',
    profile.biggest_regret ? `Their biggest regret: "${profile.biggest_regret}"` : '',
    profile.life_purpose ? `Their sense of purpose: "${profile.life_purpose}"` : '',
    '',
    '## YOUR MISSION',
    'Choose the single most meaningful question to ask this person TODAY. The question should:',
    '- Be deeply specific to WHO THEY ARE based on their profile',
    '- Open a door they may not have thought to open',
    '- Be the kind of question a world-class therapist, biographer, or wise elder would ask',
    '- Help them articulate something true about themselves that will matter to the people they leave behind',
    '- Be worded with warmth and elegant simplicity — not clinical or generic',
    '',
    '## ABSOLUTE RULES',
    '1. This question must be COMPLETELY DIFFERENT from every previous prompt listed below',
    '2. Never ask about something already covered in their existing entries',
    '3. Never be redundant, repetitive, or derivative of previous prompts',
    '4. Every question across all 365 days of a year must explore different territory',
    '5. Strategically sequence across all domains to build a complete picture over time',
    '',
    '## DOMAIN DESCRIPTIONS',
    ...Object.entries(DOMAIN_DESCRIPTIONS).map(([d, desc]) => `- ${d}: ${desc}`),
  ].filter(Boolean)

  return lines.join('\n')
}

export async function getOrCreateTodaysPrompt(): Promise<{
  prompt: { id: string; prompt_text: string; domain: Domain; delivered_date: string } | null
  error?: string
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { prompt: null, error: 'Not authenticated' }

    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

    // Check if we already have today's prompt
    const { data: existing } = await supabase
      .from('daily_prompts')
      .select('id, prompt_text, domain, delivered_date')
      .eq('user_id', user.id)
      .eq('delivered_date', today)
      .single()

    if (existing) {
      return { prompt: existing as { id: string; prompt_text: string; domain: Domain; delivered_date: string } }
    }

    // Generate a new prompt — needs full profile + history
    const service = createServiceClient()

    const [profileResult, previousPromptsResult, entriesResult] = await Promise.all([
      supabase.from('users').select('*').eq('id', user.id).single(),
      service.from('daily_prompts')
        .select('prompt_text, domain, delivered_date')
        .eq('user_id', user.id)
        .order('delivered_date', { ascending: false })
        .limit(90),
      supabase.from('soul_entries')
        .select('domain, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    const profile = (profileResult.data ?? {}) as Record<string, string | null>
    const previousPrompts = (previousPromptsResult.data ?? []) as { prompt_text: string; domain: string; delivered_date: string }[]
    const entries = (entriesResult.data ?? []) as { domain: string; content: string; created_at: string }[]

    // Build the deduplication context
    const previousList = previousPrompts.length > 0
      ? '\n## PREVIOUS PROMPTS (never repeat or be derivative of these)\n' +
        previousPrompts.map((p, i) => `${i + 1}. [${p.domain}] "${p.prompt_text}"`).join('\n')
      : ''

    const entrySummary = entries.length > 0
      ? '\n## WHAT THEY HAVE ALREADY SHARED (never ask about these topics)\n' +
        entries.slice(0, 20).map((e) => `- [${e.domain}] "${e.content.slice(0, 120)}${e.content.length > 120 ? '…' : ''}"`).join('\n')
      : ''

    // Domain frequency analysis — steer away from over-represented domains
    const domainCounts = [...previousPrompts, ...entries].reduce<Record<string, number>>((acc, item) => {
      acc[item.domain] = (acc[item.domain] ?? 0) + 1
      return acc
    }, {})
    const leastCoveredDomains = DOMAINS
      .sort((a, b) => (domainCounts[a] ?? 0) - (domainCounts[b] ?? 0))
      .slice(0, 4)

    const strategyHint = `\n## STRATEGIC GUIDANCE\nPrioritize these under-explored domains today: ${leastCoveredDomains.join(', ')}`

    const client = getOpenAIClient()

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.9,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'daily_prompt',
          strict: true,
          schema: PROMPT_SCHEMA,
        },
      },
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(profile) + previousList + entrySummary + strategyHint,
        },
        {
          role: 'user',
          content: 'Generate today\'s reflection question.',
        },
      ],
    })

    const raw = response.choices[0]?.message?.content
    if (!raw) throw new Error('No response from AI')

    const result = JSON.parse(raw) as DailyPromptResult

    // Insert via service role (bypasses RLS) with upsert to handle race conditions
    const { data: inserted, error: insertError } = await service
      .from('daily_prompts')
      .upsert({
        user_id: user.id,
        prompt_text: result.prompt_text,
        domain: result.domain,
        rationale: result.rationale,
        delivered_date: today,
      }, { onConflict: 'user_id,delivered_date', ignoreDuplicates: false })
      .select('id, prompt_text, domain, delivered_date')
      .single()

    if (insertError) throw insertError

    return { prompt: inserted as { id: string; prompt_text: string; domain: Domain; delivered_date: string } }
  } catch (err) {
    console.error('[daily-prompt] generation failed:', err)
    return { prompt: null, error: 'Could not generate today\'s prompt' }
  }
}
