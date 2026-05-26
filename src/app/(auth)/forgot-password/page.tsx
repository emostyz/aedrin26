'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { requestPasswordReset } from '@/app/actions/auth'
import { motion } from '@/components/ui/motion'

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined)

  return (
    <div className="min-h-dvh flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-[360px] space-y-8"
      >
        <p className="text-label">AEDRIN</p>

        {state?.sent ? (
          <div className="space-y-3">
            <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">Check your email.</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If an account exists for that address, we&rsquo;ve sent a link to reset your password. It may take a minute to arrive.
            </p>
            <Link href="/login" className="inline-block text-xs text-foreground underline underline-offset-4 hover:opacity-70 transition-opacity">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">Reset your password.</p>
              <p className="text-sm text-muted-foreground">Enter your email and we&rsquo;ll send you a link.</p>
            </div>

            <form action={action} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-label">Email</label>
                <input
                  id="email" name="email" type="email" autoComplete="email" required
                  className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
                />
              </div>

              {state?.error && <p role="alert" className="text-xs text-destructive">{state.error}</p>}

              <button
                type="submit" disabled={pending}
                className="w-full bg-primary text-primary-foreground rounded-xl px-4 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {pending ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              Remembered it?{' '}
              <Link href="/login" className="text-foreground underline underline-offset-4 hover:opacity-70 transition-opacity">
                Sign in
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  )
}
