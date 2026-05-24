'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOpenAIClient } from '@/lib/openai'
import type { HorizonItem, HorizonItemType, HorizonConnection } from '@/lib/supabase/types'

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function getHorizonItems(): Promise<HorizonItem[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('horizon_items')
    .select('*')
    .eq('user_id', user.id)
    .eq('resolved', false)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  return (data ?? []) as HorizonItem[]
}

// ── Add ───────────────────────────────────────────────────────────────────────

export async function addHorizonItem(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const type = (formData.get('type') as string)?.trim() as HorizonItemType
  const title = (formData.get('title') as string)?.trim().slice(0, 200) ?? ''
  const description = (formData.get('description') as string)?.trim().slice(0, 2000) || null
  const dueDateRaw = (formData.get('due_date') as string)?.trim()
  const due_date = dueDateRaw || null

  const VALID_TYPES: HorizonItemType[] = ['event', 'decision', 'concern', 'goal']
  if (!VALID_TYPES.includes(type)) return { error: 'Invalid type.' }
  if (!title) return { error: 'Title is required.' }

  const { error } = await supabase.from('horizon_items').insert({
    user_id: user.id,
    type,
    title,
    description,
    due_date,
  })

  if (error) return { error: error.message }

  revalidatePath('/app/dashboard')
  return {}
}

// ── Resolve ───────────────────────────────────────────────────────────────────

export async function resolveHorizonItem(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('horizon_items')
    .update({ resolved: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/app/dashboard')
  return {}
}

// ── AI: find connections between a horizon item and the user's soul entries ───

const CONNECTION_SCHEMA = {
  type: 'object',
  properties: {
    connections: {
      type: 'array',
      description: '2–4 specific, resonant connections. Return fewer if real connections are scarce.',
      items: {
        type: 'object',
        properties: {
          insight: {
            type: 'string',
            description:
              'A specific connection between this horizon item and something the person has actually lived. ' +
              '1–3 sentences. Draw from real details in their entries — never generalise.',
          },
          source_domain: {
            type: 'string',
            description:
              'The soul-entry domain this connection is drawn from (e.g. "career", "family", "values").',
          },
          relevance: {
            type: 'string',
            description: 'One short phrase (max 8 words) explaining the link.',
          },
        },
        required: ['insight', 'source_domain', 'relevance'],
        additionalProperties: false,
      },
    },
    framing: {
      type: 'string',
      description:
        '1–2 sentences framing how this person\'s whole story positions them for this moment. ' +
        'Warm, wise, specific to them. Empty string if data is insufficient.',
    },
  },
  required: ['connections', 'framing'],
  additionalProperties: false,
}

export async function generateHorizonConnections(
  itemId: string,
  itemType: string,
  itemTitle: string,
  itemDescription: string | null,
): Promise<{ connections: HorizonConnection[]; framing: string; error?: string }> {
  const EMPTY = { connections: [] as HorizonConnection[], framing: '' }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ...EMPTY, error: 'Not authenticated.' }

    // Fetch profile + entries in parallel
    const [profileResult, entriesResult] = await Promise.all([
      supabase
        .from('users')
        .select('legal_name, display_name, life_description, life_purpose, dob, location, relationship_status')
        .eq('id', user.id)
        .single(),
      supabase
        .from('soul_entries')
        .select('domain, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(40),
    ])

    const profile = profileResult.data
    const entries = entriesResult.data ?? []

    if (entries.length === 0 && !profile?.life_description) return EMPTY

    const name = profile?.display_name ?? profile?.legal_name ?? 'this person'

    const profileLines = [
      profile?.life_description ? `Life story: ${profile.life_description.slice(0, 500)}` : null,
      profile?.life_purpose     ? `Stated purpose: ${profile.life_purpose.slice(0, 200)}` : null,
      profile?.location         ? `Lives in: ${profile.location}` : null,
    ].filter(Boolean).join('\n')

    const entriesText = entries
      .map((e, i) => `[${i + 1} · ${e.domain}]\n${e.content.slice(0, 350)}`)
      .join('\n\n')

    const systemPrompt = `You are a thoughtful life guide helping ${name} understand how their lived story connects to what lies ahead.

Find genuine, specific connections between their stored memories and the horizon item they're navigating. Pull from actual details — names, places, choices, patterns — that appear in their entries. If you can't find real connections, return fewer rather than manufacturing generic ones.

Write with the warmth and precision of a mentor who has read their whole story.`

    const userPrompt = `HORIZON ITEM
Type: ${itemType}
Title: ${itemTitle}${itemDescription ? `\nNotes: ${itemDescription}` : ''}

PROFILE
${profileLines || '(no profile data)'}

SOUL ENTRIES (most recent first)
${entriesText || '(none yet)'}

Find 2–4 specific connections between this person's life and this horizon item.`

    const openai = getOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.4,
      max_tokens: 900,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'horizon_connections', strict: true, schema: CONNECTION_SCHEMA },
      },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw) as { connections: HorizonConnection[]; framing: string }

    return { connections: parsed.connections ?? [], framing: parsed.framing ?? '' }
  } catch (err) {
    console.error('[horizon] generateHorizonConnections error:', err)
    return EMPTY
  }
}
