'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { generateValueSummary, saveValueSummary, approveValueSummary, deleteValueSummary } from '@/app/actions/values'
import type { ValueSummary } from '@/app/actions/values'

interface Props {
  initialSummary:  ValueSummary | null
  entryCount:      number
  domainCount:     number
  totalWords:      number
  meetsThreshold:  boolean
  neededEntries:   number
  neededDomains:   number
}

export function ValuesEditor({
  initialSummary,
  entryCount,
  domainCount,
  meetsThreshold,
  neededEntries,
  neededDomains,
}: Props) {
  const router = useRouter()
  const [summary, setSummary] = useState<ValueSummary | null>(initialSummary)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(initialSummary?.content ?? '')
  const [error, setError]     = useState<string | null>(null)
  const [isPending, start]    = useTransition()

  // ── Generate / regenerate ──────────────────────────────────────────────────

  function handleGenerate() {
    setError(null)
    start(async () => {
      const result = await generateValueSummary()
      if (result.error) { setError(result.error); return }
      if (result.summary) {
        setSummary(result.summary)
        setDraft(result.summary.content)
        setEditing(false)
      }
    })
  }

  // ── Edit / save / approve / delete ────────────────────────────────────────

  function handleEdit() {
    setDraft(summary!.content)
    setEditing(true)
  }

  function handleSave() {
    setError(null)
    start(async () => {
      const result = await saveValueSummary(summary!.id, draft)
      if (result.error) { setError(result.error); return }
      setSummary((prev) => prev ? { ...prev, content: draft, approved_by_user: false, approved_at: null } : prev)
      setEditing(false)
    })
  }

  function handleApprove() {
    setError(null)
    start(async () => {
      const result = await approveValueSummary(summary!.id)
      if (result.error) { setError(result.error); return }
      setSummary((prev) => prev ? { ...prev, approved_by_user: true, approved_at: new Date().toISOString() } : prev)
    })
  }

  function handleDelete() {
    setError(null)
    start(async () => {
      const result = await deleteValueSummary(summary!.id)
      if (result.error) { setError(result.error); return }
      setSummary(null)
      setEditing(false)
      router.refresh()
    })
  }

  // ── Not enough material ────────────────────────────────────────────────────

  if (!meetsThreshold && !summary) {
    const needsMoreDomains = neededDomains > 0
    const needsMoreEntries = neededEntries > 0

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="border border-border/50 rounded-xl px-6 py-8 space-y-5">
          <div className="space-y-2">
            <p className="text-sm text-foreground font-light">Not enough material yet.</p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
              The synthesis only appears when there&apos;s enough across different areas of your life
              to surface patterns you wouldn&apos;t have seen yourself.
            </p>
          </div>

          {/* Progress toward threshold */}
          <div className="space-y-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className={entryCount >= 8 ? 'text-foreground' : ''}>
                {entryCount >= 8 ? '✓' : `${entryCount}/8`}
              </span>
              <span>entries captured{entryCount >= 8 ? ' — done' : ` (need ${neededEntries} more)`}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={domainCount >= 3 ? 'text-foreground' : ''}>
                {domainCount >= 3 ? '✓' : `${domainCount}/3`}
              </span>
              <span>
                different areas of life
                {domainCount >= 3
                  ? ' — done'
                  : ` (you have ${domainCount === 1 ? '1 area' : `${domainCount} areas`} — need ${neededDomains} more)`}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            {needsMoreEntries && (
              <Link
                href="/app/interview"
                className="text-xs text-foreground border border-border rounded-md px-3.5 py-2 hover:bg-foreground/5 transition-colors"
              >
                Capture more memories →
              </Link>
            )}
            {needsMoreDomains && (
              <p className="text-xs text-muted-foreground self-center">
                Try{' '}
                {['Childhood', 'Family', 'Career', 'Values', 'Beliefs']
                  .slice(0, 3)
                  .map((d, i, arr) => (
                    <Link
                      key={d}
                      href={`/app/interview/${d.toLowerCase()}`}
                      className="text-foreground hover:underline underline-offset-2"
                    >
                      {d}
                    </Link>
                  ))
                  .reduce<React.ReactNode[]>((acc, el, i, arr) => {
                    if (i < arr.length - 1) return [...acc, el, ', ']
                    return [...acc, el]
                  }, [])}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  // ── Has summary ────────────────────────────────────────────────────────────

  if (summary) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        {/* Status + actions */}
        <div className="flex items-center justify-between">
          <p className="text-label">
            {summary.approved_by_user ? 'Approved' : 'Draft'}
          </p>
          <div className="flex items-center gap-4">
            {!editing && (
              <>
                {!summary.approved_by_user && (
                  <button onClick={handleApprove} disabled={isPending}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
                    Approve
                  </button>
                )}
                <button onClick={handleEdit} disabled={isPending}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
                  Edit
                </button>
                <button onClick={handleDelete} disabled={isPending}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40">
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {editing ? (
            <motion.div
              key="editor"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={14}
                className="w-full bg-surface border border-border rounded-lg px-4 py-4 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
              <div className="flex items-center gap-3">
                <button onClick={handleSave} disabled={isPending || !draft.trim()}
                  className="bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity">
                  {isPending ? 'Saving…' : 'Save changes'}
                </button>
                <button onClick={() => setEditing(false)} disabled={isPending}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Cancel
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="reader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="border border-border rounded-xl px-6 py-6 space-y-4"
            >
              {summary.content.split('\n\n').filter(Boolean).map((para, i) => (
                <p key={i} className="text-sm text-foreground leading-relaxed font-light">{para}</p>
              ))}
              {summary.approved_by_user && summary.approved_at && (
                <p className="text-[11px] text-muted-foreground pt-2 border-t border-border">
                  Approved {new Date(summary.approved_at).toLocaleDateString()}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

        {/* Regenerate — only when not editing */}
        {!editing && (
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleGenerate}
              disabled={isPending}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              {isPending ? 'Generating…' : 'Regenerate from entries →'}
            </button>
            <p className="text-[10px] text-muted-foreground/40">
              {new Date(summary.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        )}
      </motion.div>
    )
  }

  // ── Meets threshold but no summary yet ────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="border border-border rounded-xl px-6 py-10 space-y-5">
        <div className="space-y-2">
          <p className="text-sm text-foreground font-light">Your story is ready to be read differently.</p>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
            You&apos;ve written across {domainCount} different areas of your life. There&apos;s enough
            material now to surface the patterns underneath — the connections you haven&apos;t made yet.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {isPending ? 'Reading your story…' : 'Generate values portrait'}
        </button>
        {isPending && (
          <p className="text-[11px] text-muted-foreground/60">
            Reading across all your entries, finding the patterns…
          </p>
        )}
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </motion.div>
  )
}
