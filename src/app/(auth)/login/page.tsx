'use client'

import { useActionState, useState, useEffect } from 'react'
import Link from 'next/link'
import { login } from '@/app/actions/auth'
import { motion } from '@/components/ui/motion'
import { GoogleButton } from '@/components/auth/google-button'

// Rotating quotes shown in the ambient panel
const QUOTES = [
  { text: 'To live in hearts we leave behind is not to die.', author: 'Thomas Campbell' },
  { text: 'The life of the dead is placed in the memory of the living.', author: 'Cicero' },
  { text: 'What we have once enjoyed we can never lose. All that we love deeply becomes a part of us.', author: 'Helen Keller' },
  { text: 'Your story is the greatest legacy that you will leave to your friends.', author: 'Steve Saint' },
]

const SSR_QUOTE = QUOTES[0]!

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined)
  const [quote, setQuote] = useState(SSR_QUOTE)

  // Pick the day-keyed quote on the client only, after hydration.
  // The panel has a 0.8s fade-in so any initial mismatch is invisible.
  useEffect(() => {
    setQuote(QUOTES[new Date().getDate() % QUOTES.length]!)
  }, [])

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
            suppressHydrationWarning
          >
            &ldquo;{quote.text}&rdquo;
          </motion.blockquote>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xs text-muted-foreground"
            suppressHydrationWarning
          >
            — {quote.author}
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
            <GoogleButton label="Sign in with Google" />
            <form action={action} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-label">Email</label>
                <input
                  id="email" name="email" type="email" autoComplete="email" required
                  className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-label">Password</label>
                  <Link href="/forgot-password" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors normal-case tracking-normal">
                    Forgot?
                  </Link>
                </div>
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
