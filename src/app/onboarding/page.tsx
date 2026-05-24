import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ensureUserProfile } from '@/lib/supabase/ensure-profile'
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow'

type Profile = { legal_name: string; onboarding_complete: boolean }

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: profile } = await supabase
    .from('users')
    .select('legal_name, onboarding_complete')
    .eq('id', user.id)
    .maybeSingle<Profile>()

  // No row yet (trigger gap) — create it so onboarding writes don't fail.
  if (!profile) {
    await ensureUserProfile(user)
    const retry = await supabase
      .from('users')
      .select('legal_name, onboarding_complete')
      .eq('id', user.id)
      .maybeSingle<Profile>()
    profile = retry.data
  }

  // Already onboarded — send to dashboard
  if (profile?.onboarding_complete) redirect('/app/dashboard')

  const legalName = profile?.legal_name ?? user.email ?? 'Friend'

  return (
    <main>
      <OnboardingFlow legalName={legalName} />
    </main>
  )
}
