'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import type { Domain } from '@/lib/supabase/types'

interface Chapter {
  domain: Domain
  label: string
  tagline: string
  dot: string
  narrative: string | null
  narrativeDate: string | null
  entries: { id: string; content: string; created_at: string }[]
  wordCount: number
  entryCount: number
  preview: string
}

interface Props {
  chapters: Chapter[]
}

export function MemoirReader({ chapters }: Props) {
  const [activeChapter, setActiveChapter] = useState<Domain | null>(
    chapters.length > 0 ? chapters[0].domain : null
  )
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set())

  const current = chapters.find((c) => c.domain === activeChapter) ?? chapters[0]

  if (!current) return null

  function toggleEntry(id: string) {
    setExpandedEntries((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8 items-start">
      {/* Chapter list — sidebar on desktop, pills on mobile */}
      <nav className="space-y-1 md:sticky md:top-8">
        <p className="text-label mb-3 hidden md:block">Chapters</p>
        {/* Mobile: horizontal scroll pills */}
        <div className="md:hidden flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {chapters.map((ch) => (
            <button
              key={ch.domain}
              type="button"
              onClick={() => setActiveChapter(ch.domain)}
              className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-xs border transition-all ${
                activeChapter === ch.domain
                  ? 'border-foreground/20 bg-surface/60 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ch.dot} ${activeChapter === ch.domain ? 'opacity-100' : 'opacity-40'}`} />
              {ch.label}
            </button>
          ))}
        </div>
        {/* Desktop: stacked list */}
        {chapters.map((ch, i) => (
          <button
            key={ch.domain}
            type="button"
            onClick={() => setActiveChapter(ch.domain)}
            className={`hidden md:flex w-full items-center gap-2.5 text-left px-3 py-2.5 rounded-lg transition-all group ${
              activeChapter === ch.domain
                ? 'bg-surface/60 text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface/30'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ch.dot} ${activeChapter === ch.domain ? 'opacity-100' : 'opacity-40 group-hover:opacity-60'} transition-opacity`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs truncate">{ch.label}</p>
              <p className={`text-[10px] tabular-nums transition-colors ${activeChapter === ch.domain ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                {ch.entryCount} {ch.entryCount === 1 ? 'memory' : 'memories'}
              </p>
            </div>
            <span className={`text-[10px] shrink-0 transition-opacity ${activeChapter === ch.domain ? 'opacity-100 text-muted-foreground/60' : 'opacity-0 group-hover:opacity-40'}`}>
              {String(i + 1).padStart(2, '0')}
            </span>
          </button>
        ))}
      </nav>

      {/* Chapter content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current.domain}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="space-y-8"
        >
          {/* Chapter header */}
          <div className="space-y-2 pb-6 border-b border-border/40">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${current.dot}`} />
              <p className="text-label text-muted-foreground/60">Chapter</p>
            </div>
            <h2 className="text-2xl font-light tracking-[-0.03em] text-foreground">
              {current.label}
            </h2>
            <p className="text-sm text-muted-foreground">{current.tagline}</p>
            <p className="text-[11px] text-muted-foreground/50">
              {current.entryCount} {current.entryCount === 1 ? 'memory' : 'memories'} ·{' '}
              {current.wordCount.toLocaleString()} words
            </p>
          </div>

          {/* AI narrative — if available */}
          {current.narrative && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <p className="text-label shrink-0">Chapter summary</p>
                <div className="flex-1 h-px bg-border/40" />
                {current.narrativeDate && (
                  <span className="text-[10px] text-muted-foreground/40 shrink-0">
                    AI · {new Date(current.narrativeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
              <div className="rounded-xl bg-surface/20 border border-border/40 px-6 py-5">
                <p className="text-[1.05rem] font-light leading-[1.9] text-foreground/80 whitespace-pre-wrap italic">
                  {current.narrative}
                </p>
              </div>
            </div>
          )}

          {/* Individual memories */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <p className="text-label shrink-0">Your memories</p>
              <div className="flex-1 h-px bg-border/40" />
            </div>

            <div className="space-y-3">
              {current.entries.map((entry, idx) => {
                const words = entry.content.trim().split(/\s+/).filter(Boolean).length
                const isLong = words > 60
                const isExpanded = expandedEntries.has(entry.id)
                const preview = isLong && !isExpanded
                  ? entry.content.trim().split(/\s+/).slice(0, 60).join(' ') + '…'
                  : entry.content

                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.3 }}
                    className="group border border-border/50 rounded-xl px-5 py-4 hover:border-border transition-colors space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-[10px] text-muted-foreground/50">
                        {new Date(entry.created_at).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      <p className="text-[10px] text-muted-foreground/40 tabular-nums">{words}w</p>
                    </div>

                    <p className="text-sm text-foreground/80 leading-relaxed font-light whitespace-pre-wrap">
                      {preview}
                    </p>

                    {isLong && (
                      <button
                        type="button"
                        onClick={() => toggleEntry(entry.id)}
                        className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                      >
                        {isExpanded ? 'Show less' : `Read full memory (${words} words)`}
                      </button>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* Next chapter shortcut */}
          {chapters.findIndex((c) => c.domain === current.domain) < chapters.length - 1 && (
            <div className="pt-4 border-t border-border/30">
              {(() => {
                const nextIdx = chapters.findIndex((c) => c.domain === current.domain) + 1
                const next = chapters[nextIdx]
                return next ? (
                  <button
                    type="button"
                    onClick={() => setActiveChapter(next.domain)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Next: {next.label} →
                  </button>
                ) : null
              })()}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
