'use client'

import { useSearchParams } from 'next/navigation'
import { useActionState, useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { resendConfirmation } from '@/app/actions/auth'

const PREVIEW_LINES = [
  "What's a childhood memory you've never written down?",
  "Who taught you the most important lesson you've ever learned?",
  "What would you want your grandchildren to know about you?",
  "What's something you believed at 20 that you no longer believe?",
  "If you could leave one piece of advice, what would it be?",
]

function ConfirmContent() {
  const params = useSearchParams()
  const email = params.get('email') ?? ''

  const [state, action, pending] = useActionState(resendConfirmation, undefined)
  const [lineIndex, setLineIndex] = useState(0)

  // Rotate the preview question every 4 seconds
  useEffect(() => {
    const id = setInterval(() => setLineIndex((i) => (i + 1) % PREVIEW_LINES.length), 4000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-dvh flex items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-[400px] space-y-10"
      >
        <p className="text-label">AEDRIN</p>

        <div className="space-y-3">
          <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
            Check your inbox.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We sent a confirmation link to{' '}
            {email ? (
              <span className="text-foreground font-medium">{email}</span>
            ) : (
              'your email address'
            )}
            . Click it to start writing.
          </p>
        </div>

        {/* Rotating question preview */}
        <div className="border border-border/60 rounded-xl px-6 py-5 bg-surface/20 space-y-2 overflow-hidden">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Waiting for you on the other side</p>
          <div className="h-10 relative">
            <AnimatePresence mode="wait">
              <motion.p
                key={lineIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
                className="text-sm text-foreground/80 leading-relaxed absolute"
              >
                {PREVIEW_LINES[lineIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            {state?.sent && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                role="status"
                className="text-xs text-foreground"
              >
                Sent — check your inbox again.
              </motion.p>
            )}
            {state?.error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                role="alert"
                className="text-xs text-destructive"
              >
                {state.error}
              </motion.p>
            )}

            <p className="text-xs text-muted-foreground">
              Didn&rsquo;t get it? Check spam, or{' '}
              <form action={action} className="inline">
                <input type="hidden" name="email" value={email} />
                <button
                  type="submit"
                  disabled={pending || !!state?.sent}
                  className="text-foreground underline underline-offset-4 hover:opacity-70 disabled:opacity-40 transition-opacity"
                >
                  {pending ? 'Sending…' : 'resend'}
                </button>
              </form>
              .
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Already confirmed?{' '}
            <Link href="/login" className="text-foreground underline underline-offset-4 hover:opacity-70 transition-opacity">
              Sign in →
            </Link>
          </p>

          <p className="text-xs text-muted-foreground">
            Wrong email?{' '}
            <Link href="/signup" className="text-foreground underline underline-offset-4 hover:opacity-70 transition-opacity">
              Start over
            </Link>
          </p>
        </div>
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
