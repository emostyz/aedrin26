import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'
import { NavClient } from '@/components/nav-client'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('users')
    .select('legal_name, display_name, onboarding_complete')
    .eq('id', user.id)
    .single()

  const profile = profileData as {
    legal_name: string
    display_name: string | null
    onboarding_complete: boolean
  } | null

  // Redirect to onboarding if intake not yet completed.
  // The /onboarding route lives outside this layout, so no loop risk.
  if (profile && !profile.onboarding_complete) {
    redirect('/onboarding')
  }

  const displayName = profile?.display_name ?? profile?.legal_name ?? 'Account'

  return (
    <div className="min-h-dvh flex flex-col">
      <NavClient displayName={displayName}>
        <form action={logout}>
          <button type="submit" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Sign out
          </button>
        </form>
      </NavClient>

      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-12">
        {children}
      </main>
    </div>
  )
}
