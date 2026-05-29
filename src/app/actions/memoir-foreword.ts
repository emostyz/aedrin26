'use server'

import { getOpenAIClient } from '@/lib/openai'
import { createClient } from '@/lib/supabase/server'
import { aiContextHeader, assertUserOwnership } from '@/lib/ai-guard'

const FOREWORD_MIN_ENTRIES = 5

interface ForewordResult {
  foreword: string
  error?: string
}

export async function generateMemoirForeword(): Promise<ForewordResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { foreword: '', error: 'Not authenticated.' }

  const [{ data: entriesData }, { data: narrativesData }, { data: profileData }] = await Promise.all([
    supabase
      .from('soul_entries')
      .select('user_id, domain, content, created_at')
      .eq('user_id', user.id)
      .is('bound_recipient_id', null)
      .order('created_at', { ascending: true })
      .limit(40),
    supabase
      .from('domain_narratives')
      .select('user_id, domain, content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('users')
      .select('display_name, legal_name, dob, job_title, location, life_description')
      .eq('id', user.id)
      .single(),
  ])

  const entries = (entriesData ?? []) as { user_id: string; domain: string; content: string; created_at: string }[]
  assertUserOwnership(entries, user.id, 'memoir-foreword/entries')

  // Latest narrative per domain
  const narrativeByDomain: Record<string, string> = {}
  for (const n of (narrativesData ?? []) as { user_id: string; domain: string; content: string }[]) {
    assertUserOwnership([n], user.id, 'memoir-foreword/narrative')
    if (!narrativeByDomain[n.domain]) narrativeByDomain[n.domain] = n.content
  }

  if (entries.length < FOREWORD_MIN_ENTRIES) {
    return { foreword: '', error: 'Write at least 5 memories before generating your foreword.' }
  }

  const profile = profileData as {
    display_name: string | null
    legal_name: string | null
    dob: string | null
    job_title: string | null
    location: string | null
    life_description: string | null
  } | null

  const name = profile?.display_name ?? profile?.legal_name ?? 'the author'
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const age = profile?.dob
    ? Math.floor((Date.now() - new Date(profile.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null

  const profileLines = [
    age ? `Age: ${age}` : '',
    profile?.job_title ? `Occupation: ${profile.job_title}` : '',
    profile?.location ? `Based in: ${profile.location}` : '',
    profile?.life_description ? `In their own words: "${profile.life_description}"` : '',
  ].filter(Boolean).join('\n')

  // Build context: narratives first (higher quality), then raw entry excerpts
  const narrativeContext = Object.entries(narrativeByDomain)
    .map(([domain, content]) => `## ${domain.charAt(0).toUpperCase() + domain.slice(1)}\n${content}`)
    .join('\n\n')

  const entryContext = entries
    .slice(0, 20)
    .map((e) => `[${e.domain}] "${e.content.slice(0, 200)}${e.content.length > 200 ? '…' : ''}"`)
    .join('\n')

  const systemPrompt =
    aiContextHeader(user.id) +
    `Today's date: ${today}. You are a master biographer and literary editor.\n\n` +
    `You have been given the life story of ${name}. Your task is to write the foreword to their memoir — ` +
    `a 3–4 paragraph introduction that introduces this person to their family and loved ones who will one day read this.\n\n` +
    `Write in the third person, as an editor who has read their full story. Be specific — name actual things ` +
    `they wrote about. The foreword should feel like it belongs at the front of a published memoir: ` +
    `dignified, warm, specific, and deeply human. It should help the reader understand who this person was ` +
    `at their core — the themes that run through their life, the contradictions, the loves, the wisdom earned.\n\n` +
    `RULES:\n` +
    `- Third person ("she", "he", "they", use ${name}'s name freely)\n` +
    `- 3–4 paragraphs, 200–350 words total\n` +
    `- Anchor every general claim to something specific from their writing\n` +
    `- End with one sentence about what this memoir is, ultimately, a testimony to\n` +
    `- No filler phrases, no generic praise, no clinical language\n` +
    `- Treat this as if it will be read at a memorial service — worthy, true, tender\n\n` +
    `## THE PERSON\n${profileLines}\n\n` +
    `## THEIR LIFE IN CHAPTERS\n${narrativeContext || entryContext}`

  const client = getOpenAIClient()
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 600,
    temperature: 0.82,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Write the foreword for ${name}'s memoir.` },
    ],
  })

  const foreword = response.choices[0]?.message?.content?.trim() ?? ''
  if (!foreword) return { foreword: '', error: 'Could not generate foreword. Please try again.' }

  return { foreword }
}
