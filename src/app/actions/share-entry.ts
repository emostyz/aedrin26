'use server'

import { createClient } from '@/lib/supabase/server'
import { signShareToken } from '@/lib/share-token'

const APP_URL = process.env.BASE_URL || 'https://www.aedrin.com'

export async function createShareLink(entryId: string): Promise<{
  url: string | null
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { url: null, error: 'Not authenticated.' }

  // Verify the entry belongs to this user
  const { data: entry } = await supabase
    .from('soul_entries')
    .select('id, user_id, sharing_status, bound_recipient_id')
    .eq('id', entryId)
    .eq('user_id', user.id)
    .single()

  if (!entry) return { url: null, error: 'Entry not found.' }
  if (entry.bound_recipient_id) return { url: null, error: 'Final letters cannot be shared publicly.' }

  const token = signShareToken(entryId, user.id)
  if (!token) {
    return { url: null, error: 'Share links are not configured. Contact support.' }
  }

  const url = `${APP_URL}/share/${token}`
  return { url }
}
