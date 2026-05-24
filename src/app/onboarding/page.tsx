import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('legal_name, onboarding_complete')
    .eq('id', user.id)
    .single()

  // Already onboarded — send to dashboard
  if (profile?.onboarding_complete) redirect('/app/dashboard')

  const legalName = profile?.legal_name ?? user.email ?? 'Friend'

  return (
    <main>
      <OnboardingFlow legalName={legalName} />
    </main>
  )
}
