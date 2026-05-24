'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { saveEntry } from '@/app/actions/entries'
import type { Domain } from '@/lib/supabase/types'

interface TodayPromptProps {
  promptId: string
  promptText: string
  domain: Domain
}

export function TodayPrompt({ promptId, promptText, domain }: TodayPromptProps) {
  const [phase, setPhase]       = useState<'idle' | 'writing' | 'done'>('idle')
  const [content, setContent]   = useState('')
  const [isPending, startT]     = useTransition()
  const [savedBrief, setSaved]  = useState(false)
  const [error, setError]       = useState<string | null>(null)

  function handleSave() {
    if (!content.trim()) return
    setError(null)
    const fd = new FormData()
    fd.set('domain', domain)
    fd.set('content', content.trim())
    fd.set('prompt_id', promptId)

    startT(async () => {
      const result = await saveEntry(fd)
      if (result?.error) { setError(result.error); return }
      setSaved(true)
      setPhase('done')
    })
  }

  const domainLabel = domain.charAt(0).toUpperCase() + domain.slice(1)

  return (
    <div className="border border-border rounded-xl p-6 sm:p-8 space-y-6">
      {/* Label row */}
      <div className="flex items-center justify-between">
        <p className="text-label">Today&apos;s reflection</p>
        <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2.5 py-1">
          {domainLabel}
        </span>
      </div>

      {/* Prompt text */}
      <AnimatePresence mode="wait">
        {phase !== 'done' ? (
          <motion.p
            key="prompt"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-[1.15rem] sm:text-[1.3rem] font-light leading-relaxed text-foreground tracking-[-0.01em]"
          >
            {promptText}
          </motion.p>
        ) : (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="space-y-2"
          >
            <p className="text-[1.1rem] font-light text-foreground">Captured. ✓</p>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">{content}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Writing area */}
      <AnimatePresence>
        {phase === 'writing' && (
          <motion.div
            key="textarea"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden space-y-3"
          >
            <textarea
              autoFocus
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your response…"
              rows={5}
              className="w-full bg-input border border-border rounded-lg px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none transition-all"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={!content.trim() || isPending}
                className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
              >
                {isPending ? 'Saving…' : 'Save reflection'}
              </button>
              <button
                onClick={() => { setPhase('idle'); setContent('') }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      {phase === 'idle' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-4"
        >
          <button
            onClick={() => setPhase('writing')}
            className="text-sm text-foreground hover:opacity-70 transition-opacity"
          >
            Respond →
          </button>
          <Link
            href={`/app/interview/${domain}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Open full {domainLabel.toLowerCase()} interview
          </Link>
        </motion.div>
      )}

      {phase === 'done' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-4"
        >
          <Link
            href={`/app/interview/${domain}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Continue {domainLabel.toLowerCase()} interview →
          </Link>
          <Link
            href="/app/review"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Review entries
          </Link>
        </motion.div>
      )}
    </div>
  )
}
