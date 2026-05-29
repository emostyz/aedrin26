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

const MAX = 10_000
function clamp(s: string | null): string | null {
  if (!s?.trim()) return null
  return s.trim().slice(0, MAX)
}

export async function updateProfileContext(
  _prevState: { error?: string; success?: boolean },
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const fields = {
    relationship_status: (formData.get('relationship_status') as string | null) || null,
    location:           clamp(formData.get('location') as string | null),
    company:            clamp(formData.get('company') as string | null),
    job_title:          clamp(formData.get('job_title') as string | null),
    job_happiness:      clamp(formData.get('job_happiness') as string | null),
    career_goals:       clamp(formData.get('career_goals') as string | null),
    family_description: clamp(formData.get('family_description') as string | null),
    life_description:   clamp(formData.get('life_description') as string | null),
    biggest_regret:     clamp(formData.get('biggest_regret') as string | null),
    life_purpose:       clamp(formData.get('life_purpose') as string | null),
  }

  const { error } = await supabase
    .from('users')
    .update(fields)
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/app/profile')
  revalidatePath('/app/dashboard')
  // AI prompts and domain context cards pick up these changes on next load
  revalidatePath('/app/interview/values')
  revalidatePath('/app/interview/lessons')
  revalidatePath('/app/interview/other')
  return { success: true }
}
