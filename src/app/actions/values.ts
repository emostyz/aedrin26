'use server'

import { createClient } from '@/lib/supabase/server'
import { getOpenAIClient } from '@/lib/openai'
import { aiContextHeader } from '@/lib/ai-guard'
import { revalidatePath } from 'next/cache'
import type { Domain } from '@/lib/supabase/types'

export interface ValueSummary {
  id: string
  content: string
  approved_by_user: boolean
  approved_at: string | null
  created_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Threshold
//
// The synthesis only exists if there's enough cross-domain material to say
// something the person genuinely couldn't have said themselves. Below this,
// the feature stays hidden — better to show nothing than something generic.
// ─────────────────────────────────────────────────────────────────────────────

const MIN_ENTRIES = 8          // at least 8 total entries across any domains
const MIN_DOMAINS = 3          // spread across at least 3 different domains
const MIN_WORDS   = 400        // at least 400 words of material to synthesise

// All domains are used — cross-domain patterns are the whole point.
const ALL_DOMAINS: Domain[] = [
  'childhood', 'family', 'career', 'values', 'beliefs', 'lessons', 'messages', 'other',
]

// ─────────────────────────────────────────────────────────────────────────────
// Prompt
//
// The test: they read it and think "I've never put it that way — but that's
// exactly it." If a sentence could be said of any thoughtful person, cut it.
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a perceptive biographer reading someone's complete life story across all its domains — childhood, career, relationships, beliefs, and hard-won lessons.

Your task: write a VALUES PORTRAIT — a distillation of who this person actually is at their core. Not what they aspire to be. Who they demonstrably are, revealed by the patterns ACROSS their life.

THE STANDARD: They should read this and think: "I've never put it that way — but that's exactly it. How did you know that?" If a sentence could be said of any thoughtful person, cut it.

WHAT TO FIND:
1. The SINGLE organizing force underneath all their stated values — the one commitment that secretly explains the others
2. The contradiction they actually live with but haven't named (e.g., "craves freedom but structures everything"; "believes in generosity but is unsparing with themselves")
3. ONE cross-domain connection they would never make themselves — what does how they describe their childhood reveal about their career choices? What does the career chapter reveal about what they ACTUALLY value vs. what they say they value?
4. The thing they will not compromise on, even when it costs them — name it specifically from what they wrote
5. What is conspicuously absent or unexamined — what they don't seem to wonder about

RULES:
- No lists of admirable values (integrity, creativity, family — anyone can write those)
- No affirmations or compliments
- No therapeutic language ("this suggests you...")
- Nothing invented — every sentence must trace to something they actually wrote
- Make the cross-domain connection explicit: name both domains

VOICE: First person, written as the subject's own articulation. "I've come to understand…" / "What I won't bend on is…" / "What surprises me, looking back…"
LENGTH: 2–3 tight paragraphs. Compression is insight — a shorter, sharper paragraph beats a longer vague one.`

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function buildContext(entries: { domain: string; content: string }[]): string {
  // Group by domain so the AI can see cross-domain patterns clearly
  const byDomain = entries.reduce<Record<string, string[]>>((acc, e) => {
    if (!acc[e.domain]) acc[e.domain] = []
    acc[e.domain].push(e.content)
    return acc
  }, {})

  return Object.entries(byDomain)
    .map(([domain, texts]) => {
      const label = domain.charAt(0).toUpperCase() + domain.slice(1)
      return `## ${label}\n${texts.map((t, i) => `[${i + 1}] ${t}`).join('\n\n')}`
    })
    .join('\n\n---\n\n')
}

async function composeSummary(userId: string, context: string): Promise<string | null> {
  const openai = getOpenAIClient()
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 700,
    temperature: 0.85,   // higher than before — compression and insight require some risk
    messages: [
      { role: 'system', content: aiContextHeader(userId) + SYSTEM_PROMPT },
      { role: 'user',   content: `Today's date: ${new Date().toISOString().slice(0, 10)}.\n\nHere is everything they have written, grouped by life domain:\n\n${context}` },
    ],
  })
  return completion.choices[0]?.message?.content?.trim() ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Threshold check
// ─────────────────────────────────────────────────────────────────────────────

interface ReadinessResult {
  entries: { domain: string; content: string; created_at: string }[]
  entryCount:  number
  domainCount: number
  totalWords:  number
  meetsThreshold: boolean
  /** How many more entries are needed before the synthesis can be meaningful */
  neededEntries: number
  neededDomains: number
}

async function checkReadiness(userId: string): Promise<ReadinessResult> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('soul_entries')
    .select('domain, content, created_at')
    .eq('user_id', userId)
    .is('bound_recipient_id', null)   // never include final letters
    .in('domain', ALL_DOMAINS)
    .order('created_at', { ascending: true })

  const entries = (data ?? []) as { domain: string; content: string; created_at: string }[]
  const entryCount  = entries.length
  const domainCount = new Set(entries.map((e) => e.domain)).size
  const totalWords  = entries.reduce((sum, e) => sum + wordCount(e.content), 0)

  const meetsThreshold =
    entryCount  >= MIN_ENTRIES &&
    domainCount >= MIN_DOMAINS &&
    totalWords  >= MIN_WORDS

  return {
    entries,
    entryCount,
    domainCount,
    totalWords,
    meetsThreshold,
    neededEntries: Math.max(0, MIN_ENTRIES - entryCount),
    neededDomains: Math.max(0, MIN_DOMAINS - domainCount),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

/** Called on page load. Returns the existing summary + readiness state. Does NOT auto-generate. */
export async function getValueSummaryState(): Promise<{
  summary:        ValueSummary | null
  entryCount:     number
  domainCount:    number
  totalWords:     number
  meetsThreshold: boolean
  neededEntries:  number
  neededDomains:  number
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {
    summary: null, entryCount: 0, domainCount: 0, totalWords: 0,
    meetsThreshold: false, neededEntries: MIN_ENTRIES, neededDomains: MIN_DOMAINS,
  }

  const [{ data: summaries }, readiness] = await Promise.all([
    supabase
      .from('value_summaries')
      .select('id, content, approved_by_user, approved_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1),
    checkReadiness(user.id),
  ])

  return {
    summary:        (summaries?.[0] ?? null) as ValueSummary | null,
    entryCount:     readiness.entryCount,
    domainCount:    readiness.domainCount,
    totalWords:     readiness.totalWords,
    meetsThreshold: readiness.meetsThreshold,
    neededEntries:  readiness.neededEntries,
    neededDomains:  readiness.neededDomains,
  }
}

/**
 * Manual generation (button press). Returns the new summary directly so the
 * client can update state without a page reload.
 */
export async function generateValueSummary(): Promise<{
  error?:   string
  summary?: ValueSummary
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const readiness = await checkReadiness(user.id)

  if (!readiness.meetsThreshold) {
    const hints: string[] = []
    if (readiness.neededEntries > 0) hints.push(`${readiness.neededEntries} more ${readiness.neededEntries === 1 ? 'entry' : 'entries'}`)
    if (readiness.neededDomains > 0) hints.push(`entries in ${readiness.neededDomains} more ${readiness.neededDomains === 1 ? 'area' : 'areas'} of your life`)
    return { error: `Not enough material yet. Add ${hints.join(' and ')} first.` }
  }

  try {
    const context = buildContext(readiness.entries)
    const content = await composeSummary(user.id, context)
    if (!content) return { error: 'Generation failed. Please try again.' }

    const { data, error } = await supabase
      .from('value_summaries')
      .insert({ user_id: user.id, content, approved_by_user: false })
      .select('id, content, approved_by_user, approved_at, created_at')
      .single()

    if (error) return { error: error.message }

    revalidatePath('/app/values')
    return { summary: data as ValueSummary }
  } catch {
    return { error: 'Generation failed. Please try again.' }
  }
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

// Keep old export name working so the page import doesn't break while we update it
export { getValueSummaryState as getOrRefreshValueSummary }
