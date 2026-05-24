'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(
  _prevState: { error?: string; success?: boolean },
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const displayName = (formData.get('display_name') as string | null)?.trim() || null
  const dob = (formData.get('dob') as string | null) || null

  const { error } = await supabase
    .from('users')
    .update({ display_name: displayName, dob })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/app/profile')
  revalidatePath('/app/dashboard')
  return { success: true }
}
