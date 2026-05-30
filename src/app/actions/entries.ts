'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Domain, SharingStatus } from '@/lib/supabase/types'

export async function saveEntry(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const domain = formData.get('domain') as Domain
  const content = formData.get('content') as string
  // prompt_id → references interview_prompts (static interview flow)
  // daily_prompt_id → references daily_prompts (AI-generated dashboard prompts)
  const promptId      = formData.get('prompt_id') as string | null
  const dailyPromptId = formData.get('daily_prompt_id') as string | null
  const mediaUrl      = formData.get('media_url') as string | null

  if (!domain || !content?.trim()) {
    return { error: 'Content is required.' }
  }

  const MAX_CONTENT = 50_000 // ~50 KB — prevents abuse and runaway AI token costs
  if (content.trim().length > MAX_CONTENT) {
    return { error: `Entry is too long (max ${MAX_CONTENT.toLocaleString()} characters).` }
  }

  const { error } = await supabase.from('soul_entries').insert({
    user_id: user.id,
    domain,
    content: content.trim(),
    prompt_id: promptId || null,
    daily_prompt_id: dailyPromptId || null,
    media_url: mediaUrl || null,
    source: mediaUrl ? 'uploaded' : 'typed',
  })

  if (error) return { error: error.message }

  revalidatePath(`/app/interview/${domain}`)
  revalidatePath('/app/dashboard')
  revalidatePath('/app/today')
  revalidatePath('/app/review')
  revalidatePath('/app/search')
  revalidatePath('/app/profile')

  return { success: true }
}

export async function getEntriesForDomain(domain: Domain) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('soul_entries')
    .select('*')
    .eq('user_id', user.id)
    .eq('domain', domain)
    .order('created_at', { ascending: false })

  return data ?? []
}

export async function updateEntry(entryId: string, content: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  if (!content?.trim()) return { error: 'Content is required.' }

  const MAX_CONTENT = 50_000
  if (content.trim().length > MAX_CONTENT) {
    return { error: `Entry is too long (max ${MAX_CONTENT.toLocaleString()} characters).` }
  }

  const { error } = await supabase
    .from('soul_entries')
    .update({ content: content.trim() })
    .eq('id', entryId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/app/review')
  revalidatePath('/app/dashboard')
  revalidatePath('/app/today')
  revalidatePath('/app/interview/[domain]', 'page')

  return { success: true }
}

export async function updateSharingStatus(entryId: string, status: SharingStatus) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('soul_entries')
    .update({ sharing_status: status })
    .eq('id', entryId)
    .eq('user_id', user.id)  // RLS guard + app-level guard

  if (error) return { error: error.message }

  revalidatePath('/app/review')
  return { success: true }
}

export async function deleteEntry(entryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('soul_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/app/review')
  revalidatePath('/app/dashboard')
  revalidatePath('/app/today')
  revalidatePath('/app/lifemap')
  revalidatePath('/app/search')
  revalidatePath('/app/profile')
  return { success: true }
}

export async function saveLetter(recipientHeirId: string, content: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  if (!content?.trim()) return { error: 'Letter cannot be empty.' }
  if (!recipientHeirId) return { error: 'Recipient is required.' }

  const MAX_CONTENT = 50_000
  if (content.trim().length > MAX_CONTENT) {
    return { error: `Letter is too long (max ${MAX_CONTENT.toLocaleString()} characters).` }
  }

  // Verify this heir belongs to the current user before writing
  const { data: heir } = await supabase
    .from('heirs')
    .select('id')
    .eq('id', recipientHeirId)
    .eq('user_id', user.id)
    .single()

  if (!heir) return { error: 'Recipient not found.' }

  const { error } = await supabase.from('soul_entries').insert({
    user_id: user.id,
    domain: 'messages',
    content: content.trim(),
    bound_recipient_id: recipientHeirId,
    sharing_status: 'private',
    source: 'typed',
  })

  if (error) return { error: error.message }

  revalidatePath('/app/letters')
  return { success: true }
}

export async function deleteLetter(entryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('soul_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', user.id)
    .eq('domain', 'messages')
    .not('bound_recipient_id', 'is', null)

  if (error) return { error: error.message }

  revalidatePath('/app/letters')
  return { success: true }
}

export async function getAllEntries() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('soul_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return data ?? []
}
