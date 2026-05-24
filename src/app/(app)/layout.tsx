import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('legal_name, display_name')
    .eq('id', user.id)
    .single() as { data: { legal_name: string; display_name: string | null } | null }

  const displayName = profile?.display_name ?? profile?.legal_name ?? 'Account'

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 h-14 flex items-center justify-between">
          <Link href="/app/dashboard" className="text-sm font-semibold tracking-tight text-foreground">
            AEDRIN
          </Link>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/app/interview" className="hover:text-foreground transition-colors">Capture</Link>
            <Link href="/app/review" className="hover:text-foreground transition-colors">Review</Link>
            <Link href="/app/lifemap" className="hover:text-foreground transition-colors">Life map</Link>
            <Link href="/app/settings" className="hover:text-foreground transition-colors">Settings</Link>
            <Link href="/app/executor" className="hover:text-foreground transition-colors">Executor</Link>
          </nav>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">{displayName}</span>
            <form action={logout}>
              <button
                type="submit"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-10">
        {children}
      </main>
    </div>
  )
}
