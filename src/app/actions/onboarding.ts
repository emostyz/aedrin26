'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function completeOnboarding(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const relationship_status = (formData.get('relationship_status') as string) || null
  const location = (formData.get('location') as string)?.trim() || null
  const life_description = (formData.get('life_description') as string)?.trim() || null
  const biggest_regret = (formData.get('biggest_regret') as string)?.trim() || null
  const life_purpose = (formData.get('life_purpose') as string)?.trim() || null

  const { error } = await supabase
    .from('users')
    .update({
      relationship_status,
      location,
      life_description,
      biggest_regret,
      life_purpose,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return { error: error.message }

  // Dashboard will generate today's prompt on arrival — no need for fire-and-forget here.
  redirect('/app/dashboard')
}
