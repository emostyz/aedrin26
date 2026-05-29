import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ensureUserProfile } from '@/lib/supabase/ensure-profile'
import { logout } from '@/app/actions/auth'
import { NavClient } from '@/components/nav-client'
import { GlobalSearchShortcut } from '@/components/search/global-search-shortcut'
import { QuickCapture } from '@/components/capture/quick-capture'
import { ShortcutsHelp } from '@/components/shortcuts-help'

type Profile = {
  legal_name: string
  display_name: string | null
  onboarding_complete: boolean
}

const PROFILE_COLUMNS = 'legal_name, display_name, onboarding_complete'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: profile } = await supabase
    .from('users')
    .select(PROFILE_COLUMNS)
    .eq('id', user.id)
    .maybeSingle<Profile>()

  // No row yet (trigger gap / pre-trigger account) — create it, then re-read.
  if (!profile) {
    await ensureUserProfile(user)
    const retry = await supabase
      .from('users')
      .select(PROFILE_COLUMNS)
      .eq('id', user.id)
      .maybeSingle<Profile>()
    profile = retry.data
  }

  // Redirect to onboarding if intake not yet completed.
  // The /onboarding route lives outside this layout, so no loop risk.
  if (profile && !profile.onboarding_complete) {
    redirect('/onboarding')
  }

  const displayName = profile?.display_name ?? profile?.legal_name ?? 'Account'

  return (
    <div className="min-h-dvh flex flex-col">
      <GlobalSearchShortcut />
      <NavClient displayName={displayName}>
        <form action={logout}>
          <button type="submit" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Sign out
          </button>
        </form>
      </NavClient>

      {/* pb-24 reserves space for the fixed mobile bottom nav bar */}
      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-12 pb-24 md:pb-12">
        {children}
      </main>

      {/* Global floating quick-capture button (N shortcut) */}
      <QuickCapture />

      {/* Keyboard shortcuts help (? shortcut) */}
      <ShortcutsHelp />
    </div>
  )
}
