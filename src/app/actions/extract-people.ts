'use server'

import { getOpenAIClient } from '@/lib/openai'
import { createClient } from '@/lib/supabase/server'
import { aiContextHeader, assertUserOwnership } from '@/lib/ai-guard'

export interface Person {
  name: string
  relationship: string        // e.g. "mother", "childhood friend", "mentor"
  description: string         // 1–2 sentence character sketch
  mentionCount: number        // how many times they appear across entries
  domains: string[]           // which domains they're mentioned in
}

interface ExtractResult {
  people: Person[]
  error?: string
}

export async function extractPeopleFromStory(): Promise<ExtractResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { people: [], error: 'Not authenticated.' }

  const { data: entriesData } = await supabase
    .from('soul_entries')
    .select('user_id, domain, content, created_at')
    .eq('user_id', user.id)
    .is('bound_recipient_id', null)
    .order('created_at', { ascending: false })
    .limit(60)

  const entries = (entriesData ?? []) as {
    user_id: string; domain: string; content: string; created_at: string
  }[]

  assertUserOwnership(entries, user.id, 'extract-people/entries')

  if (entries.length < 2) {
    return { people: [], error: 'Write at least a few memories first.' }
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const entryContext = entries
    .map((e) => `[${e.domain}] "${e.content.slice(0, 300)}${e.content.length > 300 ? '…' : ''}"`)
    .join('\n\n')

  const systemPrompt =
    aiContextHeader(user.id) +
    `Today's date: ${today}.\n\n` +
    `You are a careful literary analyst reading someone's memoir entries. ` +
    `Extract all the real people mentioned across these entries — not the author themselves, ` +
    `but everyone they write about: family, friends, mentors, colleagues.\n\n` +
    `For each person, write a brief character sketch based ONLY on what is actually written. ` +
    `Do not invent or embellish. If little is said about someone, say so briefly.\n\n` +
    `Return a JSON array with this exact schema:\n` +
    `[\n  {\n    "name": "The name they use (first name if that's all given)",\n    "relationship": "how they relate to the author (e.g. mother, college roommate, boss)",\n    "description": "1-2 sentences: who they are based on what is written",\n    "mentionCount": <number of entries they appear in>,\n    "domains": ["childhood", "family"] // which domains they appear in\n  }\n]\n\n` +
    `Only include real named people (not unnamed groups like "my classmates"). ` +
    `Skip anyone mentioned only in passing with no real detail. ` +
    `Maximum 15 people. Sort by how central they seem to the story (most central first).\n\n` +
    `## THE MEMOIR ENTRIES\n${entryContext}`

  const client = getOpenAIClient()
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1200,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Extract the people from these memoir entries.' },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? ''

  let people: Person[] = []
  try {
    const parsed = JSON.parse(raw) as { people?: Person[] } | Person[]
    people = Array.isArray(parsed) ? parsed : (parsed.people ?? [])
  } catch {
    return { people: [], error: 'Could not parse response. Please try again.' }
  }

  return { people }
}
