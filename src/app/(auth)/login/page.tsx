'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { login } from '@/app/actions/auth'
import { createClient } from '@/lib/supabase/client'
import { motion } from '@/components/ui/motion'

// Rotating quotes shown in the ambient panel
const QUOTES = [
  { text: 'To live in hearts we leave behind is not to die.', author: 'Thomas Campbell' },
  { text: 'The life of the dead is placed in the memory of the living.', author: 'Cicero' },
  { text: 'What we have once enjoyed we can never lose. All that we love deeply becomes a part of us.', author: 'Helen Keller' },
  { text: 'Your story is the greatest legacy that you will leave to your friends.', author: 'Steve Saint' },
]

// Day-of-month index: same value on server and client, rotates daily
const QUOTE = QUOTES[new Date().getDate() % QUOTES.length]!

function GoogleButton() {
  const [error, setError] = useState<string | null>(null)

  async function handleGoogle() {
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError('Google sign-in is not enabled yet.')
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleGoogle}
        className="w-full flex items-center justify-center gap-2.5 border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all duration-200"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="oklch(0.6 0 0)"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="oklch(0.5 0 0)"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="oklch(0.55 0 0)"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="oklch(0.65 0 0)"/>
        </svg>
        Continue with Google
      </button>
      {error && <p className="text-xs text-destructive text-center">{error}</p>}
    </div>
  )
}

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined)

  return (
    <div className="min-h-dvh flex">
      {/* ── Ambient quote panel (desktop only) ─────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 border-r border-border px-12 py-14">
        <p className="text-sm font-medium tracking-[0.08em] text-foreground">AEDRIN</p>

        <div className="space-y-4">
          <motion.blockquote
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-[1.05rem] font-light text-foreground/70 leading-relaxed tracking-[-0.01em]"
          >
            &ldquo;{QUOTE.text}&rdquo;
          </motion.blockquote>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xs text-muted-foreground"
          >
            — {QUOTE.author}
          </motion.p>
        </div>

        <p className="text-xs text-muted-foreground/40">
          An operating system for your soul.
        </p>
      </div>

      {/* ── Auth form ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-full max-w-[360px] space-y-8"
        >
          {/* Mobile-only wordmark */}
          <p className="lg:hidden text-label">AEDRIN</p>

          <div className="space-y-1">
            <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
              Welcome back.
            </p>
            <p className="text-sm text-muted-foreground">Sign in to continue your story.</p>
          </div>

          <div className="space-y-5">
            <GoogleButton />

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <form action={action} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-label">Email</label>
                <input
                  id="email" name="email" type="email" autoComplete="email" required
                  className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-label">Password</label>
                <input
                  id="password" name="password" type="password" autoComplete="current-password" required
                  className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
                />
              </div>

              {state?.error && (
                <p role="alert" className="text-xs text-destructive">{state.error}</p>
              )}

              <button
                type="submit" disabled={pending}
                className="w-full bg-primary text-primary-foreground rounded-xl px-4 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {pending ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              No account?{' '}
              <Link href="/signup" className="text-foreground underline underline-offset-4 hover:opacity-70 transition-opacity">
                Create one
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
