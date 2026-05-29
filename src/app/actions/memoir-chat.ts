'use server'

import { getOpenAIClient } from '@/lib/openai'
import { createClient } from '@/lib/supabase/server'
import { assertUserOwnership, aiContextHeader } from '@/lib/ai-guard'
import { saveEntry } from '@/app/actions/entries'
import { getOrRefreshDomainNarrative } from '@/app/actions/domain-narrative'
import type { Domain } from '@/lib/supabase/types'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export async function getMemoirChatResponse(
  messages: ChatMessage[],
  domain: Domain,
): Promise<{ reply: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated.')

  // Fetch profile context
  const { data: profile } = await supabase
    .from('users')
    .select('legal_name, display_name, family_description, life_description, career_goals, job_title')
    .eq('id', user.id)
    .single()

  // Guard: profile row belongs to authenticated user
  if (profile) {
    assertUserOwnership([{ user_id: user.id, ...profile }], user.id, 'memoir-chat/profile')
  }

  const firstName = profile?.display_name?.split(' ')[0]
    ?? profile?.legal_name?.split(' ')[0]
    ?? 'there'

  const domainLabel = domain === 'other' ? 'life' : domain

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const profileLines: string[] = []
  if (profile?.job_title) profileLines.push(`Job title: ${profile.job_title}`)
  if (profile?.career_goals) profileLines.push(`Career goals: ${profile.career_goals}`)
  if (profile?.family_description) profileLines.push(`Family: ${profile.family_description}`)
  if (profile?.life_description) profileLines.push(`Life description: ${profile.life_description}`)

  const profileSection = profileLines.length > 0
    ? `\n\nProfile context:\n${profileLines.join('\n')}`
    : ''

  const systemPrompt =
    aiContextHeader(user.id) +
    `You are a warm, thoughtful biographer helping ${firstName} preserve their life story. ` +
    `You're having a conversation about their ${domainLabel} to draw out meaningful memories. ` +
    `Ask one focused follow-up question at a time. Be curious, warm, and specific. ` +
    `Reference what they've just shared. Keep responses concise — 1-3 sentences max plus your next question.` +
    profileSection +
    `\n\nToday's date: ${today}`

  const client = getOpenAIClient()
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 300,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  })

  const reply = response.choices[0]?.message?.content ?? 'Tell me more about that.'
  return { reply }
}

export async function saveConversationAsEntries(
  messages: ChatMessage[],
  domain: Domain,
  /** Number of user messages that were already saved in a previous batch.
   *  We skip those and only persist anything new since the last save, so a
   *  user who keeps the conversation going after saving doesn't double-write. */
  alreadySavedCount: number = 0,
): Promise<{ saved: number; skipped: number; failed: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { saved: 0, skipped: 0, failed: 0, error: 'Not authenticated.' }

  // Only the substantive user turns get saved — short throwaway replies
  // ("yeah", "haha") don't earn an entry. Anything under 20 chars is skipped.
  const eligible = messages.filter(
    (m) => m.role === 'user' && m.content.trim().length >= 20,
  )

  // Skip the first `alreadySavedCount` eligible messages — they were saved
  // in a previous batch and re-saving would create duplicates.
  const toSave = eligible.slice(alreadySavedCount)

  let saved = 0
  let failed = 0
  for (const msg of toSave) {
    const fd = new FormData()
    fd.set('domain', domain)
    fd.set('content', msg.content.trim())
    const result = await saveEntry(fd)
    if (result?.error) {
      failed++
      console.error('[memoir-chat] saveEntry failed:', result.error)
    } else {
      saved++
    }
  }

  // After saving new entries, kick off a domain-narrative refresh.
  // The function self-throttles (regenerates at most once per day and only
  // when there are new entries since the last run), so calling it here is
  // safe even if the user runs multiple save batches in a row. We don't
  // await it — narrative generation can take a few seconds and the user
  // shouldn't be blocked waiting on it after their conversation save.
  if (saved > 0) {
    getOrRefreshDomainNarrative(domain).catch((err) => {
      console.error('[memoir-chat] narrative refresh failed:', err)
    })
  }

  return { saved, skipped: alreadySavedCount, failed }
}
