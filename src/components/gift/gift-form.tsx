'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { createGiftInvitation } from '@/app/actions/gift'
import type { GiftRelationship } from '@/lib/supabase/types'

const RELATIONSHIPS: { value: GiftRelationship; label: string }[] = [
  { value: 'parent',      label: 'Parent' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'partner',     label: 'Partner' },
  { value: 'sibling',     label: 'Sibling' },
  { value: 'child',       label: 'Child' },
  { value: 'friend',      label: 'Friend' },
  { value: 'other',       label: 'Someone else' },
]

const MAX_NOTE_LENGTH = 500

export function GiftForm() {
  const [relationship, setRelationship] = useState<GiftRelationship | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ name: string; email: string } | null>(null)
  const [isPending, start] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const name = (fd.get('recipient_name') as string)?.trim() ?? ''
    const email = (fd.get('recipient_email') as string)?.trim() ?? ''

    start(async () => {
      const result = await createGiftInvitation(fd)
      if (result.error) { setError(result.error); return }
      setSent({ name, email })
      setRelationship(null)
      setNote('')
      // The form input fields reset automatically by re-render below
    })
  }

  // ── Success state ────────────────────────────────────────────────────────
  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="border border-border rounded-xl px-6 py-8 space-y-5 text-center"
      >
        <div className="space-y-2">
          <p className="text-sm text-foreground font-light">Invitation sent.</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {sent.name} will receive an email from you at <span className="text-foreground">{sent.email}</span>.
            If they reply to it, it&apos;ll come straight back to your inbox — not ours.
          </p>
        </div>
        <button
          onClick={() => setSent(null)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          + Send another
        </button>
      </motion.div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Recipient name */}
      <div className="space-y-2">
        <label htmlFor="recipient_name" className="text-label">Their name</label>
        <input
          id="recipient_name"
          name="recipient_name"
          type="text"
          required
          maxLength={80}
          placeholder="e.g. Mom, or Sarah"
          className="w-full bg-input border border-border rounded-md px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Recipient email */}
      <div className="space-y-2">
        <label htmlFor="recipient_email" className="text-label">Their email</label>
        <input
          id="recipient_email"
          name="recipient_email"
          type="email"
          required
          placeholder="you@theirs.com"
          className="w-full bg-input border border-border rounded-md px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <p className="text-[11px] text-muted-foreground/60">
          They&apos;ll need to sign up with this exact email when they accept.
        </p>
      </div>

      {/* Relationship */}
      <div className="space-y-2">
        <label className="text-label">Who they are to you</label>
        <div className="flex flex-wrap gap-2">
          {RELATIONSHIPS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRelationship(r.value)}
              className={`px-3.5 py-2 rounded-full text-xs border transition-all duration-200 ${
                relationship === r.value
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {/* Hidden input so the server action receives the relationship */}
        <input type="hidden" name="relationship" value={relationship ?? ''} />
      </div>

      {/* Personal note */}
      <div className="space-y-2">
        <label htmlFor="sender_note" className="text-label">
          A note to them <span className="text-muted-foreground/60 normal-case tracking-normal">(optional)</span>
        </label>
        <textarea
          id="sender_note"
          name="sender_note"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_LENGTH))}
          rows={4}
          placeholder="Why you want them to do this. Keep it short — anything you write here appears at the top of their email."
          className="w-full bg-input border border-border rounded-md px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground/60">
          <span>This appears as a personal note at the top of their email.</span>
          <span>{note.length} / {MAX_NOTE_LENGTH}</span>
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            key="err"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="text-xs text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Submit */}
      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={isPending || !relationship}
          className="bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-xs font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
        >
          {isPending ? 'Sending…' : 'Send invitation'}
        </button>
        <p className="text-[11px] text-muted-foreground/60">
          You can send up to 5 invitations a day.
        </p>
      </div>
    </form>
  )
}
