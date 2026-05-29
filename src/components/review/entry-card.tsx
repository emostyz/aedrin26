'use client'

import { useState, useTransition, useRef } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { updateSharingStatus, updateEntry, deleteEntry } from '@/app/actions/entries'
import { createShareLink } from '@/app/actions/share-entry'
import { ReadingMode } from './reading-mode'
import type { Database, Domain } from '@/lib/supabase/types'

type Entry = Database['public']['Tables']['soul_entries']['Row']

// Subtle domain colour chips — left-border accent
const DOMAIN_ACCENT: Record<Domain, string> = {
  childhood: 'border-l-amber-500/50',
  family:    'border-l-rose-500/50',
  career:    'border-l-blue-500/50',
  values:    'border-l-emerald-500/50',
  beliefs:   'border-l-violet-500/50',
  lessons:   'border-l-orange-500/50',
  messages:  'border-l-teal-500/50',
  other:     'border-l-border',
}

const WORDS_PER_MIN = 200

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function readingTime(words: number) {
  const mins = Math.max(1, Math.round(words / WORDS_PER_MIN))
  return `${mins} min`
}


export function EntryCard({ entry, promptText, onDeleted, alwaysShowControls }: { entry: Entry; promptText?: string | null; onDeleted?: () => void; alwaysShowControls?: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [isSharing, startSharing] = useTransition()
  const [expanded, setExpanded]     = useState(false)
  const [isEditing, setIsEditing]   = useState(false)
  const [isReading, setIsReading]   = useState(false)
  const [editContent, setEditContent] = useState(entry.content)
  const [savedContent, setSavedContent] = useState(entry.content)
  const [editError, setEditError]   = useState<string | null>(null)
  const [savedBrief, setSavedBrief] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleted, setDeleted]       = useState(false)
  const [sharecopied, setShareCopied] = useState(false)
  const textareaRef                 = useRef<HTMLTextAreaElement>(null)

  const isShareable = entry.sharing_status === 'shareable'
  const words = wordCount(savedContent)
  const isLong = savedContent.length > 280

  function openEdit() {
    setEditContent(savedContent)
    setEditError(null)
    setIsEditing(true)
    setTimeout(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
      // Auto-size
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }, 50)
  }

  function cancelEdit() {
    setEditContent(savedContent)
    setEditError(null)
    setIsEditing(false)
  }

  function saveEdit() {
    if (!editContent.trim()) return
    setEditError(null)
    startTransition(async () => {
      const result = await updateEntry(entry.id, editContent)
      if (result?.error) { setEditError(result.error); return }
      setSavedContent(editContent.trim())
      setIsEditing(false)
      setSavedBrief(true)
      setTimeout(() => setSavedBrief(false), 2000)
    })
  }

  function toggleShare() {
    startTransition(async () => {
      await updateSharingStatus(entry.id, isShareable ? 'private' : 'shareable')
    })
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    startTransition(async () => {
      const result = await deleteEntry(entry.id)
      if (result?.error) { setEditError(result.error); setConfirmDelete(false); return }
      setDeleted(true)
      onDeleted?.()
    })
  }

  function handleShareLink() {
    startSharing(async () => {
      const result = await createShareLink(entry.id)
      if (!result.url) return
      try {
        await navigator.clipboard.writeText(result.url)
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2500)
      } catch {
        // Clipboard not available — open in new tab so user can copy manually
        window.open(result.url, '_blank')
      }
    })
  }

  if (deleted) return null

  const readingEntry = {
    id: entry.id,
    domain: entry.domain as Domain,
    content: savedContent,
    created_at: entry.created_at,
    sharing_status: entry.sharing_status,
  }

  return (
    <>
      <AnimatePresence>
        {isReading && (
          <ReadingMode
            entry={readingEntry}
            promptText={promptText}
            onClose={() => setIsReading(false)}
          />
        )}
      </AnimatePresence>

    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
      transition={{ duration: 0.3 }}
      className={`group border border-l-2 border-border rounded-lg px-5 py-4 space-y-3 transition-colors duration-200 ${
        isEditing ? 'border-foreground/20' : 'hover:border-foreground/10'
      } ${DOMAIN_ACCENT[entry.domain as Domain] ?? 'border-l-border'}`}
    >
      {/* Entry text — collapsible OR edit textarea */}
      <AnimatePresence mode="wait" initial={false}>
        {isEditing ? (
          <motion.div
            key="edit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="space-y-2"
          >
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => {
                setEditContent(e.target.value)
                // Auto-resize
                e.target.style.height = 'auto'
                e.target.style.height = `${e.target.scrollHeight}px`
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') cancelEdit()
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit()
              }}
              className="w-full bg-input border border-border rounded-md px-3.5 py-3 text-sm text-foreground leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring resize-none transition-all"
              style={{ minHeight: '80px' }}
            />
            {editError && (
              <p role="alert" className="text-xs text-destructive">{editError}</p>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={saveEdit}
                disabled={!editContent.trim() || isPending}
                className="bg-primary text-primary-foreground rounded-md px-3.5 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={cancelEdit}
                disabled={isPending}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <span className="text-[10px] text-muted-foreground/40">⌘↵ to save · Esc to cancel</span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="space-y-2"
          >
            {promptText && (
              <p className="text-[11px] text-muted-foreground/60 leading-snug font-light">
                {promptText}
              </p>
            )}
            <p className={`text-sm text-foreground leading-relaxed ${!expanded && isLong ? 'line-clamp-4' : ''}`}>
              {savedContent}
            </p>

            <div className="flex items-center gap-3">
              {isLong && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  {expanded ? 'Show less' : 'Read more'}
                </button>
              )}
              <AnimatePresence>
                {savedBrief && (
                  <motion.span
                    key="saved"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[10px] text-muted-foreground"
                  >
                    Saved.
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {entry.media_url && (
        <a
          href={entry.media_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ↑ Attachment
        </a>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
          <span>
            {new Date(entry.created_at).toLocaleDateString(undefined, {
              year: 'numeric', month: 'short', day: 'numeric',
            })}
          </span>
          <span>·</span>
          <span>{words} words</span>
          {words >= 40 && (
            <>
              <span>·</span>
              <span>{readingTime(words)} read</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Read button — opens full-screen reading mode */}
          {!isEditing && words >= 20 && (
            <button
              onClick={() => setIsReading(true)}
              className={`text-[10px] text-muted-foreground/40 hover:text-foreground transition-all duration-150 ${alwaysShowControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              aria-label="Reading mode"
            >
              Read
            </button>
          )}

          {/* Share link button */}
          {!isEditing && !entry.bound_recipient_id && (
            <button
              onClick={handleShareLink}
              disabled={isSharing}
              className={`text-[10px] transition-all duration-150 disabled:opacity-30 ${alwaysShowControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${sharecopied ? 'text-foreground' : 'text-muted-foreground/40 hover:text-foreground'}`}
              aria-label="Share memory"
            >
              {isSharing ? '…' : sharecopied ? '✓ Link copied' : 'Share'}
            </button>
          )}

          {/* Edit button */}
          {!isEditing && (
            <button
              onClick={openEdit}
              className={`text-[10px] text-muted-foreground/40 hover:text-foreground transition-all duration-150 ${alwaysShowControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              aria-label="Edit entry"
            >
              Edit
            </button>
          )}

          {/* Delete button — requires two clicks (confirm step) */}
          {!isEditing && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className={`text-[10px] transition-all duration-150 disabled:opacity-30 ${alwaysShowControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${
                confirmDelete
                  ? 'text-destructive hover:text-destructive'
                  : 'text-muted-foreground/40 hover:text-destructive'
              }`}
              onBlur={() => setConfirmDelete(false)}
            >
              {confirmDelete ? 'Sure?' : 'Delete'}
            </button>
          )}

          <button
            onClick={toggleShare}
            disabled={isPending}
            aria-pressed={isShareable}
            title={isShareable ? 'Your heirs can read this entry' : 'Only visible to you — heirs cannot see this'}
            className={`text-[10px] px-2.5 py-1 rounded-full border transition-all duration-200 disabled:opacity-40 ${
              isShareable
                ? 'border-foreground/25 text-foreground bg-foreground/5'
                : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'
            }`}
          >
            {isPending ? '…' : isShareable ? 'For heirs' : 'Only me'}
          </button>
        </div>
      </div>
    </motion.div>
    </>
  )
}
