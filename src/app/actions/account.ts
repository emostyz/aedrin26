'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'

export async function deleteAccount(_prevState: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const confirmedEmail = (formData.get('email') as string | null)?.trim().toLowerCase()
  if (confirmedEmail !== user.email?.toLowerCase()) {
    return { error: 'Email does not match. Please type your exact email address.' }
  }

  const service = createServiceClient()
  const { error } = await service.auth.admin.deleteUser(user.id)
  if (error) return { error: error.message }

  // Sign out locally then redirect
  await supabase.auth.signOut()
  redirect('/')
}
