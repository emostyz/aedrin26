'use server'

import { createClient } from '@/lib/supabase/server'
import type { Domain } from '@/lib/supabase/types'

const MAX_CONTENT = 50_000

// Saves one answer from the first-run guided setup as a soul entry.
export async function saveSetupAnswer(
  domain: Domain,
  content: string,
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const trimmed = content.trim()
  if (!trimmed) return { error: 'Answer is empty.' }
  if (trimmed.length > MAX_CONTENT) return { error: 'Answer is too long.' }

  const { error } = await supabase
    .from('soul_entries')
    .insert({ user_id: user.id, domain, content: trimmed, source: 'typed' })

  if (error) return { error: error.message }
  return { success: true }
}

// Marks the guided setup finished so the daily cadence takes over tomorrow.
export async function completeSetup(): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('users')
    .update({ setup_complete: true })
    .eq('id', user.id)

  if (error) return { error: error.message }
  // Intentionally NO revalidatePath: keep the "all done, come back tomorrow"
  // card on screen instead of swapping straight to today's daily prompt.
  return { success: true }
}
