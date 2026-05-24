'use client'

import { useActionState, useState } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { deleteAccount } from '@/app/actions/account'

export default function DeleteAccountPage() {
  const [confirmed, setConfirmed]   = useState(false)
  const [state, action, isPending]  = useActionState(deleteAccount, {})

  if (!confirmed) {
    return (
      <div className="space-y-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <p className="text-label">Delete account</p>
          <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
            This cannot be undone.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            All soul entries, life events, values, heirs, executors, and your profile will be permanently deleted.
            We recommend{' '}
            <a href="/app/export" className="underline underline-offset-2 hover:text-foreground transition-colors">
              exporting your data
            </a>{' '}
            first.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
        >
          <button
            onClick={() => setConfirmed(true)}
            className="border border-destructive/40 text-destructive rounded-md px-5 py-2.5 text-xs font-medium hover:bg-destructive/5 transition-colors"
          >
            I understand — continue to deletion
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="space-y-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
        <p className="text-label">Confirm deletion</p>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          Type your email to confirm.
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}>
        <form action={action} className="space-y-5 max-w-sm">
          <div className="space-y-1.5">
            <label htmlFor="delete-email" className="text-label">Email address</label>
            <input
              id="delete-email"
              name="email"
              type="email"
              required
              placeholder="your@email.com"
              className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <AnimatePresence>
            {state?.error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                role="alert"
                className="text-xs text-destructive"
              >
                {state.error}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={isPending}
              className="bg-destructive text-white rounded-md px-5 py-2.5 text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {isPending ? 'Deleting…' : 'Permanently delete account'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmed(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
