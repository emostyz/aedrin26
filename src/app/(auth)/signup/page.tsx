'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signup } from '@/app/actions/auth'
import { motion } from '@/components/ui/motion'

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined)

  return (
    <div className="min-h-dvh flex">
      {/* ── Ambient panel (desktop only) ─────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 border-r border-border px-12 py-14">
        <p className="text-sm font-medium tracking-[0.08em] text-foreground">AEDRIN</p>

        <div className="space-y-6">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-[1.05rem] font-light text-foreground/60 leading-relaxed tracking-[-0.01em]"
          >
            Your story is the greatest legacy you will ever leave.
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="space-y-1.5"
          >
            {['Capture your memories.', 'Discover your patterns.', 'Leave something real behind.'].map((line, i) => (
              <p key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0" />
                {line}
              </p>
            ))}
          </motion.div>
        </div>

        <p className="text-xs text-muted-foreground/40">An operating system for your soul.</p>
      </div>

      {/* ── Sign-up form ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-full max-w-[360px] space-y-8"
        >
          <p className="lg:hidden text-label">AEDRIN</p>

          <div className="space-y-1">
            <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
              Begin here.
            </p>
            <p className="text-sm text-muted-foreground">Your story starts now.</p>
          </div>

          <div className="space-y-5">
            <form action={action} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="legal_name" className="text-label">Legal name</label>
                <input
                  id="legal_name" name="legal_name" type="text" autoComplete="name" required
                  className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
                />
              </div>

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
                  id="password" name="password" type="password" autoComplete="new-password" required minLength={8}
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
                {pending ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="text-foreground underline underline-offset-4 hover:opacity-70 transition-opacity">
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
