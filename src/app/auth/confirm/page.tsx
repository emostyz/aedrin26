'use client'

import { useSearchParams } from 'next/navigation'
import { useActionState, Suspense } from 'react'
import Link from 'next/link'
import { motion } from '@/components/ui/motion'
import { resendConfirmation } from '@/app/actions/auth'

function ConfirmContent() {
  const params = useSearchParams()
  const email = params.get('email') ?? ''

  const [state, action, pending] = useActionState(resendConfirmation, undefined)

  return (
    <div className="min-h-dvh flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-[360px] space-y-8"
      >
        <p className="text-label">AEDRIN</p>

        <div className="space-y-2">
          <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
            Check your inbox.
          </p>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to{' '}
            {email ? (
              <span className="text-foreground font-medium">{email}</span>
            ) : (
              'your email address'
            )}
            . Click it to finish creating your account.
          </p>
        </div>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Didn&rsquo;t get it? Check your spam folder, or resend below.</p>

          {state?.sent && (
            <p role="status" className="text-foreground text-xs">
              Sent — check your inbox again.
            </p>
          )}
          {state?.error && (
            <p role="alert" className="text-destructive text-xs">{state.error}</p>
          )}

          <form action={action}>
            <input type="hidden" name="email" value={email} />
            <button
              type="submit"
              disabled={pending || !!state?.sent}
              className="text-foreground underline underline-offset-4 hover:opacity-70 disabled:opacity-40 transition-opacity"
            >
              {pending ? 'Sending…' : 'Resend confirmation email'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Wrong account?{' '}
          <Link href="/signup" className="text-foreground underline underline-offset-4 hover:opacity-70 transition-opacity">
            Sign up again
          </Link>
        </p>
      </motion.div>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense>
      <ConfirmContent />
    </Suspense>
  )
}
