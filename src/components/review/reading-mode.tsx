'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import type { Domain } from '@/lib/supabase/types'

const DOMAIN_LABELS: Record<Domain, string> = {
  childhood: 'Childhood', family: 'Family', career: 'Career',
  values: 'Values', beliefs: 'Beliefs', lessons: 'Lessons',
  messages: 'Messages', other: 'Other',
}

interface Props {
  entry: {
    id: string
    domain: Domain
    content: string
    created_at: string
    sharing_status: string
  }
  promptText?: string | null
  onClose: () => void
}

export function ReadingMode({ entry, promptText, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const wordCount = entry.content.trim().split(/\s+/).filter(Boolean).length
  const readTime  = Math.max(1, Math.round(wordCount / 200))

  function copyToClipboard() {
    navigator.clipboard.writeText(entry.content).catch(() => {})
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
            {DOMAIN_LABELS[entry.domain] ?? entry.domain}
          </span>
          <span className="text-muted-foreground/30">·</span>
          <span className="text-[10px] text-muted-foreground/60">
            {new Date(entry.created_at).toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </span>
          <span className="text-muted-foreground/30">·</span>
          <span className="text-[10px] text-muted-foreground/60">
            {wordCount.toLocaleString()} words · {readTime} min read
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={copyToClipboard}
            className="text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close reading mode"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-8 py-16 space-y-8">
          {promptText && (
            <p className="text-sm text-muted-foreground/70 italic leading-relaxed border-l-2 border-border pl-4">
              {promptText}
            </p>
          )}
          <p className="text-lg font-light leading-[1.85] text-foreground tracking-[-0.01em] whitespace-pre-wrap">
            {entry.content}
          </p>
          <p className="text-[10px] text-muted-foreground/40 pt-4 border-t border-border/30">
            {entry.sharing_status === 'shareable' ? 'Marked for heirs' : 'Private — only you'}
            {' · '}
            Press Esc to close
          </p>
        </div>
      </div>
    </motion.div>
  )
}
