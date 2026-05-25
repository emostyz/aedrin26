'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createAccessRequest } from '@/app/actions/representative'
import { FadeUp } from '@/components/ui/motion'

const ROLES = [
  { value: 'next_of_kin', label: 'Next of kin / family' },
  { value: 'heir', label: 'Named heir' },
  { value: 'executor', label: 'Executor' },
  { value: 'legal_representative', label: 'Legal representative' },
  { value: 'other', label: 'Other' },
]

export default function NewRequestPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await createAccessRequest(fd)
      if (res.error) { setError(res.error); return }
      if (res.requestId) router.push(`/app/represent/${res.requestId}`)
    })
  }

  return (
    <div className="space-y-8 max-w-md">
      <FadeUp className="space-y-2">
        <p className="text-label">Request access</p>
        <p className="text-[1.5rem] font-light tracking-[-0.02em] text-foreground leading-snug">
          Who are you requesting access to?
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We&rsquo;ll verify your relationship before any access is granted. This is only
          available for accounts that have been memorialized.
        </p>
      </FadeUp>

      <FadeUp delay={0.05}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="deceased_email" className="text-label">Their email</label>
            <input
              id="deceased_email" name="deceased_email" type="email" required
              placeholder="The email on their AEDRIN account"
              className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="claimed_role" className="text-label">Your role</label>
            <select
              id="claimed_role" name="claimed_role" required defaultValue="next_of_kin"
              className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="relationship" className="text-label">Your relationship to them</label>
            <input
              id="relationship" name="relationship" type="text" required maxLength={200}
              placeholder="e.g. Daughter, spouse, appointed executor"
              className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="message" className="text-label">
              Anything else <span className="normal-case font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="message" name="message" rows={3} maxLength={2000}
              placeholder="Context that helps us verify your request."
              className="w-full bg-input border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

          <div className="flex items-center gap-4">
            <Link href="/app/represent" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              ← Back
            </Link>
            <button
              type="submit" disabled={pending}
              className="bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity ml-auto"
            >
              {pending ? 'Creating…' : 'Continue →'}
            </button>
          </div>
        </form>
      </FadeUp>
    </div>
  )
}
