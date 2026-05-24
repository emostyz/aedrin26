'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const MAX_FIELD_LENGTH = 10_000 // 10 KB cap on any single intake field

function clamp(s: string | null): string | null {
  if (!s) return null
  return s.slice(0, MAX_FIELD_LENGTH)
}

export async function completeOnboarding(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const relationship_status = (formData.get('relationship_status') as string) || null
  const location            = clamp((formData.get('location') as string)?.trim() || null)
  const life_description    = clamp((formData.get('life_description') as string)?.trim() || null)
  const biggest_regret      = clamp((formData.get('biggest_regret') as string)?.trim() || null)
  const life_purpose        = clamp((formData.get('life_purpose') as string)?.trim() || null)

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

  // ── Save intake answers as soul entries so they appear in domain pages ──────
  // These become the first entries in their domains; the user can reference,
  // expand, or share them just like any journaled reflection.
  const intakeEntries: Array<{ domain: string; content: string }> = []

  if (life_description) {
    intakeEntries.push({ domain: 'other',   content: life_description })
  }
  if (biggest_regret) {
    // Lessons is the natural home for regret — wisdom earned through difficulty
    intakeEntries.push({ domain: 'lessons', content: biggest_regret })
  }
  if (life_purpose) {
    // Values is where purpose lives
    intakeEntries.push({ domain: 'values',  content: life_purpose })
  }

  if (intakeEntries.length > 0) {
    // Non-blocking: profile is already saved; don't fail onboarding if this errors
    try {
      await supabase.from('soul_entries').insert(
        intakeEntries.map((e) => ({
          user_id: user.id,
          domain:  e.domain,
          content: e.content,
          source:  'typed' as const,
        })),
      )
    } catch { /* intentionally swallowed */ }
  }

  redirect('/app/dashboard')
}
