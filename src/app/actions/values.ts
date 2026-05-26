'use server'

import { createClient } from '@/lib/supabase/server'
import { getOpenAIClient } from '@/lib/openai'
import { aiContextHeader } from '@/lib/ai-guard'
import { revalidatePath } from 'next/cache'

export interface ValueSummary {
  id: string
  content: string
  approved_by_user: boolean
  approved_at: string | null
  created_at: string
}

const VALUE_DOMAINS = ['values', 'beliefs', 'lessons']

const SYSTEM_PROMPT = `You are a rare reader of people — part moral philosopher, part biographer who has sat with thousands of lives. From the reflections below (this person's values, beliefs, and hard-won lessons), compose a portrait of their inner architecture, written in their OWN first-person voice.

Do NOT produce a tidy list of admirable values. Instead:
- Find the ORGANIZING principle beneath the stated values — the single commitment that quietly explains the others.
- Name the tensions and contradictions they actually live by (e.g. craves freedom yet anchors to duty), plainly and without judgment.
- Trace how a value was FORGED — connect a belief to the specific lesson or wound that shaped it.
- Distinguish what they would defend at any cost from what they hold loosely.
- Connect reflections from different places that they themselves would never think to connect.

The test: they read it and think "I've never put it that way — but that's exactly it." If a sentence could be said of anyone, cut it.

Voice: first person ("I've come to believe…", "What I won't bend on is…"). Warm, exact, unsentimental — never motivational or greeting-card. 3–4 short paragraphs. Ground every claim in the material; invent nothing.`

async function composeSummary(userId: string, context: string): Promise<string | null> {
  const openai = getOpenAIClient()
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 800,
    temperature: 0.7,
    messages: [
      { role: 'system', content: aiContextHeader(userId) + SYSTEM_PROMPT },
      { role: 'user', content: `Here are my recorded reflections:\n\n${context}` },
    ],
  })
  return completion.choices[0]?.message?.content ?? null
}

function buildContext(entries: { domain: string; content: string }[]): string {
  return entries.map((e, i) => `[${e.domain} — entry ${i + 1}]\n${e.content}`).join('\n\n')
}

// Manual, explicit regeneration (button in the editor).
export async function generateValueSummary(): Promise<{ error?: string; summaryId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: entries } = await supabase
    .from('soul_entries')
    .select('domain, content')
    .eq('user_id', user.id)
    .in('domain', VALUE_DOMAINS)
    .order('created_at', { ascending: true }) as { data: { domain: string; content: string }[] | null }

  if (!entries || entries.length === 0) {
    return { error: 'No entries found in Values, Beliefs, or Lessons. Add some reflections first.' }
  }

  try {
    const content = await composeSummary(user.id, buildContext(entries))
    if (!content) return { error: 'Generation failed. Please try again.' }

    const { data, error } = await supabase
      .from('value_summaries')
      .insert({ user_id: user.id, content, approved_by_user: false })
      .select('id')
      .single()

    if (error) return { error: error.message }
    revalidatePath('/app/values')
    return { summaryId: (data as { id: string }).id }
  } catch {
    return { error: 'Generation failed. Please try again.' }
  }
}

// Auto-refresh: regenerate at most once per day, and ONLY when there are new
// reflections since the last summary. Returns the summary to show + entry count.
export async function getOrRefreshValueSummary(): Promise<{ summary: ValueSummary | null; entryCount: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { summary: null, entryCount: 0 }

  const [{ data: summaries }, { data: entriesData }] = await Promise.all([
    supabase
      .from('value_summaries')
      .select('id, content, approved_by_user, approved_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('soul_entries')
      .select('domain, content, created_at')
      .eq('user_id', user.id)
      .in('domain', VALUE_DOMAINS)
      .order('created_at', { ascending: true }),
  ])

  const latest = (summaries?.[0] ?? null) as ValueSummary | null
  const entries = (entriesData ?? []) as { domain: string; content: string; created_at: string }[]
  const entryCount = entries.length
  if (entryCount === 0) return { summary: latest, entryCount }

  const today = new Date().toISOString().slice(0, 10)
  const newestEntryAt = entries.reduce((max, e) => (e.created_at > max ? e.created_at : max), '')
  const hasNewIntel = !latest || newestEntryAt > latest.created_at
  const notYetToday = !latest || latest.created_at.slice(0, 10) < today

  // Only spend an AI call when there's genuinely new material, once a day.
  if (hasNewIntel && notYetToday) {
    try {
      const content = await composeSummary(user.id, buildContext(entries))
      if (content) {
        const { data } = await supabase
          .from('value_summaries')
          .insert({ user_id: user.id, content, approved_by_user: false })
          .select('id, content, approved_by_user, approved_at, created_at')
          .single()
        if (data) return { summary: data as ValueSummary, entryCount }
      }
    } catch {
      /* fall through to the existing summary */
    }
  }

  return { summary: latest, entryCount }
}

export async function saveValueSummary(summaryId: string, content: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('value_summaries')
    .update({ content, approved_by_user: false, approved_at: null })
    .eq('id', summaryId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/app/values')
  return {}
}

export async function approveValueSummary(summaryId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('value_summaries')
    .update({ approved_by_user: true, approved_at: new Date().toISOString() })
    .eq('id', summaryId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/app/values')
  return {}
}

export async function deleteValueSummary(summaryId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('value_summaries')
    .delete()
    .eq('id', summaryId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/app/values')
  return {}
}
