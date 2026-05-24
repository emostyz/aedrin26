'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { generateValueSummary, saveValueSummary, approveValueSummary, deleteValueSummary } from '@/app/actions/values'

type Summary = {
  id: string
  content: string
  approved_by_user: boolean
  approved_at: string | null
  created_at: string
}

interface Props {
  initialSummary: Summary | null
  entryCount: number
}

export function ValuesEditor({ initialSummary, entryCount }: Props) {
  const [summary, setSummary]   = useState<Summary | null>(initialSummary)
  const [editing, setEditing]   = useState(false)
  const [draft, setDraft]       = useState(initialSummary?.content ?? '')
  const [error, setError]       = useState<string | null>(null)
  const [isPending, start]      = useTransition()

  function handleGenerate() {
    setError(null)
    start(async () => {
      const result = await generateValueSummary()
      if (result.error) { setError(result.error); return }
      // Reload will happen via revalidatePath; optimistically set a placeholder
      window.location.reload()
    })
  }

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
    })
  }

  if (!summary) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="border border-border rounded-lg px-5 py-10 text-center space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {entryCount === 0
              ? 'Record your values, beliefs, and lessons first — then generate a synthesis here.'
              : `${entryCount} reflections ready. Generate a synthesis of your values and beliefs.`}
          </p>
          {entryCount > 0 && (
            <button
              onClick={handleGenerate}
              disabled={isPending}
              className="bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {isPending ? 'Generating…' : 'Generate values summary'}
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-xs text-destructive text-center">{error}</p>
        )}
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Status bar */}
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
            className="border border-border rounded-lg px-5 py-6 space-y-4"
          >
            {summary.content.split('\n\n').filter(Boolean).map((para, i) => (
              <p key={i} className="text-sm text-foreground leading-relaxed">{para}</p>
            ))}
            {summary.approved_by_user && summary.approved_at && (
              <p className="text-[11px] text-muted-foreground pt-2 border-t border-border">
                Approved {new Date(summary.approved_at).toLocaleDateString()}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p role="alert" className="text-xs text-destructive">{error}</p>
      )}

      {/* Regenerate */}
      {!editing && (
        <div className="pt-2">
          <button onClick={handleGenerate} disabled={isPending}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
            {isPending ? 'Regenerating…' : 'Regenerate from entries →'}
          </button>
        </div>
      )}
    </motion.div>
  )
}
