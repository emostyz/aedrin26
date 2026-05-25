'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createNegotiation } from '@/app/actions/negotiation'

export function StartNegotiation({ deceasedUserId }: { deceasedUserId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('deceased_user_id', deceasedUserId)
    startTransition(async () => {
      const res = await createNegotiation(fd)
      if (res.error) { setError(res.error); return }
      if (res.negotiationId) router.push(`/app/legacy/${deceasedUserId}/negotiations/${res.negotiationId}`)
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-xs font-medium hover:opacity-90 transition-opacity"
      >
        Start a negotiation
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border border-border rounded-lg p-4">
      <div className="space-y-1.5">
        <label htmlFor="title" className="text-label">What needs deciding?</label>
        <input
          id="title" name="title" type="text" required maxLength={200}
          placeholder="e.g. How we honor Dad's wish about the house"
          className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="description" className="text-label">
          Context <span className="normal-case font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="description" name="description" rows={2} maxLength={2000}
          className="w-full bg-input border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="relationship" className="text-label">Your relationship to them</label>
        <input
          id="relationship" name="relationship" type="text" required maxLength={200}
          placeholder="e.g. Son"
          className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="non_negotiables" className="text-label">
          Your non-negotiables <span className="normal-case font-normal text-muted-foreground">(one per line, optional)</span>
        </label>
        <textarea
          id="non_negotiables" name="non_negotiables" rows={3}
          placeholder={'The letters stay in the family\nNo decisions without my sister present'}
          className="w-full bg-input border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
      </div>

      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center gap-4">
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </button>
        <button
          type="submit" disabled={pending}
          className="bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity ml-auto"
        >
          {pending ? 'Creating…' : 'Create negotiation'}
        </button>
      </div>
    </form>
  )
}
