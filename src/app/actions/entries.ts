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
  const promptId = formData.get('prompt_id') as string | null
  const mediaUrl = formData.get('media_url') as string | null

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
    media_url: mediaUrl || null,
    source: mediaUrl ? 'uploaded' : 'typed',
  })

  if (error) return { error: error.message }

  revalidatePath(`/app/interview/${domain}`)
  revalidatePath('/app/dashboard')
  revalidatePath('/app/review')

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
