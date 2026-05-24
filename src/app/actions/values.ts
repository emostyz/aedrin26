'use server'

import { createClient } from '@/lib/supabase/server'
import { getOpenAIClient } from '@/lib/openai'
import { revalidatePath } from 'next/cache'

export async function generateValueSummary(): Promise<{ error?: string; summaryId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: entries } = await supabase
    .from('soul_entries')
    .select('domain, content')
    .eq('user_id', user.id)
    .in('domain', ['values', 'beliefs', 'lessons'])
    .order('created_at', { ascending: true }) as { data: { domain: string; content: string }[] | null }

  if (!entries || entries.length === 0) {
    return { error: 'No entries found in Values, Beliefs, or Lessons. Add some reflections first.' }
  }

  const context = entries
    .map((e, i) => `[${e.domain} — entry ${i + 1}]\n${e.content}`)
    .join('\n\n')

  try {
    const openai = getOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 700,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: `You are a thoughtful synthesizer helping someone articulate their core values and beliefs.
Based only on the recorded reflections provided, write a 3–5 paragraph summary of this person's values, beliefs, and life wisdom.
Use first person ("I believe…", "What matters most to me…").
Do not invent anything not present in the material. Stay grounded and specific.
Write with warmth, clarity, and quiet authority.`,
        },
        {
          role: 'user',
          content: `Here are my recorded reflections:\n\n${context}`,
        },
      ],
    })

    const content = completion.choices[0]?.message?.content
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
