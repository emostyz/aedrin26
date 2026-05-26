'use client'

import { createClient } from '@/lib/supabase/client'

// Renders only when NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true'. Set that (and
// configure Google as a provider in the Supabase dashboard) to turn it on —
// until then nothing renders, so there is never a button that errors on click.
export function GoogleButton({ label = 'Continue with Google' }: { label?: string }) {
  if (process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED !== 'true') return null

  async function signIn() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/app/dashboard` },
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={signIn}
        className="w-full flex items-center justify-center gap-2.5 border border-border rounded-xl px-4 py-3 text-sm text-foreground hover:bg-surface transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
          <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"/>
        </svg>
        {label}
      </button>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>
    </>
  )
}
