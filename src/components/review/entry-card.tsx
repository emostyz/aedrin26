'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { updateSharingStatus } from '@/app/actions/entries'
import type { Database, SharingStatus, Domain } from '@/lib/supabase/types'

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

const COLLAPSE_LINES = 4 // show 4 lines, then "Read more"

export function EntryCard({ entry }: { entry: Entry }) {
  const [isPending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState(false)
  const isShareable = entry.sharing_status === 'shareable'
  const words = wordCount(entry.content)
  const isLong = entry.content.length > 280 // ~4 lines at 70 chars/line

  function toggle() {
    startTransition(async () => {
      await updateSharingStatus(entry.id, isShareable ? 'private' : 'shareable')
    })
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`group border border-l-2 border-border rounded-lg px-5 py-4 space-y-3 hover:border-foreground/10 transition-colors duration-200 ${DOMAIN_ACCENT[entry.domain as Domain] ?? 'border-l-border'}`}
    >
      {/* Entry text — collapsible */}
      <div className="space-y-2">
        <motion.p
          layout
          className={`text-sm text-foreground leading-relaxed ${!expanded && isLong ? 'line-clamp-4' : ''}`}
        >
          {entry.content}
        </motion.p>

        <AnimatePresence>
          {isLong && (
            <motion.button
              key="toggle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              {expanded ? 'Show less' : 'Read more'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

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

        <button
          onClick={toggle}
          disabled={isPending}
          aria-pressed={isShareable}
          className={`text-[10px] px-2.5 py-1 rounded-full border transition-all duration-200 disabled:opacity-40 ${
            isShareable
              ? 'border-foreground/25 text-foreground bg-foreground/5'
              : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'
          }`}
        >
          {isPending ? '…' : isShareable ? 'Shareable' : 'Private'}
        </button>
      </div>
    </motion.div>
  )
}
