'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Domain } from '@/lib/supabase/types'

export async function addCustomQuestion(domain: Domain, text: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const trimmed = text?.trim()
  if (!trimmed || trimmed.length < 5) return { error: 'Question is too short.' }
  if (trimmed.length > 500) return { error: 'Question is too long (max 500 characters).' }

  const { error } = await supabase
    .from('custom_questions')
    .insert({ user_id: user.id, domain, text: trimmed })

  if (error) return { error: error.message }

  revalidatePath(`/app/interview/${domain}`)
  return { success: true }
}

export async function deleteCustomQuestion(questionId: string, domain: Domain) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('custom_questions')
    .delete()
    .eq('id', questionId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath(`/app/interview/${domain}`)
  return { success: true }
}
