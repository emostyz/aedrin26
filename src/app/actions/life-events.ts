'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createLifeEvent(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const title = formData.get('title') as string
  const eventDate = formData.get('event_date') as string | null
  const description = formData.get('description') as string | null

  if (!title?.trim()) return { error: 'Title is required.' }

  const { error } = await supabase.from('life_events').insert({
    user_id: user.id,
    title: title.trim(),
    event_date: eventDate || null,
    description: description?.trim() || null,
  })

  if (error) return { error: error.message }

  revalidatePath('/app/lifemap')
  return { success: true }
}

export async function updateLifeEvent(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const title = formData.get('title') as string
  const eventDate = formData.get('event_date') as string | null
  const description = formData.get('description') as string | null

  if (!title?.trim()) return { error: 'Title is required.' }

  const { error } = await supabase
    .from('life_events')
    .update({
      title: title.trim(),
      event_date: eventDate || null,
      description: description?.trim() || null,
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/app/lifemap')
  return { success: true }
}

export async function deleteLifeEvent(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('life_events')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/app/lifemap')
  return { success: true }
}
