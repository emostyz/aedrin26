'use server'

import { getOpenAIClient } from '@/lib/openai'
import type { Domain } from '@/lib/supabase/types'

const DOMAIN_CONTEXT: Record<Domain, string> = {
  childhood: 'early memories, home life, formative experiences',
  family: 'parents, siblings, family relationships and traditions',
  career: 'professional life, work experiences, achievements and failures',
  values: 'core beliefs, principles, and how they changed over time',
  beliefs: 'views on mortality, faith, spirituality, and how to treat people',
  lessons: 'life wisdom, mistakes, advice to pass on',
  messages: 'personal messages to loved ones',
  other: 'personal reflections',
}

export async function suggestFollowUps(domain: Domain, entryContent: string): Promise<string[]> {
  try {
    const client = getOpenAIClient()

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `You are a gentle, thoughtful interviewer helping someone capture their life story in the domain of ${DOMAIN_CONTEXT[domain]}.
Your role is to suggest 2-3 follow-up questions or prompts based on what they've written, to help them go deeper.
Return ONLY a JSON array of strings — the follow-up questions. No explanation, no preamble.
Keep each question under 30 words. Make them open, warm, and specific to what they shared.`,
        },
        {
          role: 'user',
          content: `The person wrote: "${entryContent}"\n\nSuggest 2-3 follow-up questions to help them go deeper.`,
        },
      ],
    })

    const raw = response.choices[0]?.message?.content ?? '[]'

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(cleaned)

    if (!Array.isArray(parsed)) return []
    return parsed.filter((s): s is string => typeof s === 'string').slice(0, 3)
  } catch {
    return []
  }
}
