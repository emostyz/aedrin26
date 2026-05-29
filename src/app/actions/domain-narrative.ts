'use server'

import { createClient } from '@/lib/supabase/server'
import { getOpenAIClient } from '@/lib/openai'
import { aiContextHeader } from '@/lib/ai-guard'
import type { Domain } from '@/lib/supabase/types'

// Domains that benefit from a narrative synthesis.
// Values/beliefs/lessons are handled by value_summaries; messages are final letters.
const NARRATIVE_DOMAINS: Domain[] = ['childhood', 'family', 'career', 'other']

const DOMAIN_PROMPTS: Record<string, string> = {
  childhood: `You are a memoirist helping someone discover the through-lines of their early life.
From the childhood reflections below, write a short first-person narrative — as if the person themselves is recounting it.

Focus on:
- The texture of their upbringing (place, family, atmosphere)
- A moment or pattern that formed who they became
- What they carried into adulthood from those years

Voice: first person, warm and specific. Avoid generic summaries. 2–3 short paragraphs. Stay close to what they actually wrote.`,

  family: `You are a biographer writing a person's chapter on family.
From the reflections below, write a short first-person narrative that captures:
- Who their key people are and what they mean to this person
- The shape of their relationships — closeness, complexity, love
- What family has taught or cost them

Voice: first person, honest and warm. 2–3 short paragraphs. Use only what they've shared — invent nothing.`,

  career: `You are writing the professional chapter of someone's life story.
From their career reflections below, write a short first-person narrative that captures:
- How their working life has unfolded and what they've built
- What they've learned — about work, about themselves
- What they are proud of, and what they would do differently

Voice: first person, clear-eyed. 2–3 short paragraphs. Stay grounded in what they actually said.`,

  other: `You are helping someone see the whole of their inner life.
From these reflections — things that don't fit neatly elsewhere — write a short first-person narrative that:
- Finds threads connecting these thoughts
- Names what they seem to care about that hasn't been said elsewhere
- Gives shape to what might otherwise feel scattered

Voice: first person, thoughtful. 2–3 short paragraphs. Only draw on what's there.`,
}

const MIN_ENTRIES = 2  // Don't generate with fewer than this many entries

async function generateNarrative(userId: string, domain: string, entries: { content: string }[]): Promise<string | null> {
  const prompt = DOMAIN_PROMPTS[domain]
  if (!prompt) return null

  const today = new Date().toISOString().slice(0, 10)
  const context = entries.map((e, i) => `[Entry ${i + 1}]\n${e.content}`).join('\n\n')

  const openai = getOpenAIClient()
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 600,
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content: `Today's date: ${today}.\n\n${aiContextHeader(userId)}${prompt}`,
      },
      {
        role: 'user',
        content: `Here are my ${domain} reflections:\n\n${context}`,
      },
    ],
  })
  return completion.choices[0]?.message?.content?.trim() ?? null
}

export interface DomainNarrative {
  id: string
  content: string
  entryCount: number
  createdAt: string
}

/**
 * Returns the latest cached narrative for a domain, regenerating at most once
 * per day and only when there are new entries since the last generation.
 */
export async function getOrRefreshDomainNarrative(
  domain: Domain,
): Promise<{ narrative: DomainNarrative | null; entryCount: number }> {
  if (!NARRATIVE_DOMAINS.includes(domain)) {
    return { narrative: null, entryCount: 0 }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { narrative: null, entryCount: 0 }

  const [{ data: cached }, { data: entriesData }] = await Promise.all([
    supabase
      .from('domain_narratives')
      .select('id, content, entry_count, created_at')
      .eq('user_id', user.id)
      .eq('domain', domain)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('soul_entries')
      .select('content, created_at')
      .eq('user_id', user.id)
      .eq('domain', domain)
      .is('bound_recipient_id', null)   // exclude final letters
      .order('created_at', { ascending: true }),
  ])

  const entries = (entriesData ?? []) as { content: string; created_at: string }[]
  const entryCount = entries.length

  if (entryCount < MIN_ENTRIES) {
    return { narrative: null, entryCount }
  }

  const latest = (cached?.[0] ?? null) as { id: string; content: string; entry_count: number; created_at: string } | null

  const today = new Date().toISOString().slice(0, 10)
  const newestEntryAt = entries.reduce((max, e) => (e.created_at > max ? e.created_at : max), '')
  const hasNewIntel = !latest || newestEntryAt > latest.created_at
  const notYetToday = !latest || latest.created_at.slice(0, 10) < today

  if (hasNewIntel && notYetToday) {
    try {
      const content = await generateNarrative(user.id, domain, entries)
      if (content) {
        const { data } = await supabase
          .from('domain_narratives')
          .insert({ user_id: user.id, domain, content, entry_count: entryCount })
          .select('id, content, entry_count, created_at')
          .single()
        if (data) {
          const row = data as { id: string; content: string; entry_count: number; created_at: string }
          return {
            narrative: { id: row.id, content: row.content, entryCount: row.entry_count, createdAt: row.created_at },
            entryCount,
          }
        }
      }
    } catch {
      /* fall through to stale cache */
    }
  }

  if (!latest) return { narrative: null, entryCount }
  return {
    narrative: { id: latest.id, content: latest.content, entryCount: latest.entry_count, createdAt: latest.created_at },
    entryCount,
  }
}
