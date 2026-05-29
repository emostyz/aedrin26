'use server'

import { createClient } from '@/lib/supabase/server'
import { getOpenAIClient } from '@/lib/openai'
import { aiContextHeader } from '@/lib/ai-guard'
import type { Domain } from '@/lib/supabase/types'

export async function generateWritingSparks(
  domain: Domain,
): Promise<{ sparks: string[] | null; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { sparks: null, error: 'Not authenticated' }

  const today = new Date().toISOString().slice(0, 10)

  const systemPrompt =
    `${aiContextHeader(user.id)}` +
    `You are a thoughtful guide helping someone document their life story. ` +
    `Generate 3 short, specific, deeply personal writing prompts for the ${domain} domain. ` +
    `Today's date: ${today}. ` +
    `Return a JSON array of exactly 3 strings. ` +
    `Each prompt should be 1 sentence, under 20 words, starting with an action verb or question word. ` +
    `Be specific and evocative.`

  try {
    const openai = getOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 256,
      temperature: 0.9,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content:
            `Give me 3 writing sparks for my ${domain} domain. ` +
            `Return JSON with a single key "sparks" containing an array of exactly 3 prompt strings.`,
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? ''
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { sparks: null, error: 'Failed to parse AI response' }
    }

    // Accept either { sparks: [...] } or a bare array
    let sparks: string[] | null = null
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      Array.isArray((parsed as Record<string, unknown>)['sparks'])
    ) {
      sparks = ((parsed as Record<string, unknown>)['sparks'] as unknown[])
        .slice(0, 3)
        .map(String)
    } else if (Array.isArray(parsed)) {
      sparks = (parsed as unknown[]).slice(0, 3).map(String)
    }

    if (!sparks || sparks.length === 0) {
      return { sparks: null, error: 'No sparks returned' }
    }

    return { sparks }
  } catch (err) {
    console.error('[writing-sparks] OpenAI error', err)
    return { sparks: null, error: 'Failed to generate sparks' }
  }
}
