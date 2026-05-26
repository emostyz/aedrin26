'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { updatePassword } from '@/app/actions/auth'
import { motion } from '@/components/ui/motion'

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(updatePassword, undefined)

  return (
    <div className="min-h-dvh flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-[360px] space-y-8"
      >
        <p className="text-label">AEDRIN</p>

        <div className="space-y-1">
          <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">Choose a new password.</p>
          <p className="text-sm text-muted-foreground">Make it something you&rsquo;ll remember.</p>
        </div>

        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-label">New password</label>
            <input
              id="password" name="password" type="password" autoComplete="new-password" required minLength={8}
              className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirm" className="text-label">Confirm password</label>
            <input
              id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8}
              className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
            />
          </div>

          {state?.error && <p role="alert" className="text-xs text-destructive">{state.error}</p>}

          <button
            type="submit" disabled={pending}
            className="w-full bg-primary text-primary-foreground rounded-xl px-4 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {pending ? 'Saving…' : 'Set new password'}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/forgot-password" className="text-foreground underline underline-offset-4 hover:opacity-70 transition-opacity">
            Request a new link
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
