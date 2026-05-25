'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Domain } from '@/lib/supabase/types'

const ALL_DOMAINS: Domain[] = ['childhood','family','career','values','beliefs','lessons','messages','other']

// ─── Heirs ────────────────────────────────────────────────────────────────────

export async function addHeir(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const name = (formData.get('name') as string)?.trim()
  const relationship = (formData.get('relationship') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()

  if (!name || !relationship || !email) return { error: 'All fields are required.' }

  const { data: heir, error: heirError } = await supabase
    .from('heirs')
    .insert({ user_id: user.id, name, relationship, email })
    .select('id')
    .single()

  if (heirError) return { error: heirError.message }

  // Create a permission row for every domain, defaulting to false
  const perms = ALL_DOMAINS.map((domain) => ({
    heir_id: heir.id,
    domain,
    allowed: false,
  }))
  await supabase.from('heir_permissions').insert(perms)

  revalidatePath('/app/settings')
  return { success: true, heirId: heir.id }
}

export async function removeHeir(heirId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('heirs')
    .delete()
    .eq('id', heirId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/app/settings')
  return { success: true }
}

export async function updateHeirPermissions(heirId: string, domain: Domain, allowed: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // Verify this heir belongs to the current user
  const { data: heir } = await supabase
    .from('heirs')
    .select('id')
    .eq('id', heirId)
    .eq('user_id', user.id)
    .single()

  if (!heir) return { error: 'Heir not found.' }

  const { error } = await supabase
    .from('heir_permissions')
    .update({ allowed })
    .eq('heir_id', heirId)
    .eq('domain', domain)

  if (error) return { error: error.message }
  revalidatePath('/app/settings')
  return { success: true }
}

// ─── Executors ────────────────────────────────────────────────────────────────

export async function addExecutor(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()

  if (!name || !email) return { error: 'Name and email are required.' }

  const { error } = await supabase
    .from('executors')
    .insert({ user_id: user.id, name, email })

  if (error) return { error: error.message }
  revalidatePath('/app/settings')
  return { success: true }
}

export async function removeExecutor(executorId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('executors')
    .delete()
    .eq('id', executorId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/app/settings')
  return { success: true }
}

// ─── Notifications ──────────────────────────────────────────────────────────

export async function updateReminderPreference(enabled: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('users')
    .update({ reminders_enabled: enabled })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/app/settings')
  return { success: true }
}
