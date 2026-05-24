import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LandingPage } from '@/components/landing/landing-page'

export const metadata = {
  title: 'AEDRIN — An operating system for your soul.',
  description: "Capture your memories, wisdom, and voice — so the people you love can know you long after you're gone.",
}

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/app/dashboard')
  return <LandingPage />
}
