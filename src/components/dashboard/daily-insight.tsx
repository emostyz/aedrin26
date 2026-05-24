'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'

interface DailyInsightProps {
  insightText: string
  recommendation: string | null
  patternSources: string[]
}

export function DailyInsight({ insightText, recommendation, patternSources }: DailyInsightProps) {
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const sourcesLabel = patternSources.length > 0
    ? patternSources.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' · ')
    : null

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
          className="space-y-4"
        >
          {/* Divider with label */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">Pattern</p>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="space-y-3">
            {/* Source domains */}
            {sourcesLabel && (
              <p className="text-[10px] text-muted-foreground tracking-wider">{sourcesLabel}</p>
            )}

            {/* Insight text */}
            <motion.p
              className={`text-sm text-foreground leading-relaxed font-light ${
                !expanded ? 'line-clamp-3' : ''
              }`}
            >
              {insightText}
            </motion.p>

            {/* Expand / collapse if text is long */}
            {insightText.length > 200 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? 'Show less' : 'Read more'}
              </button>
            )}

            {/* Recommendation — only when present */}
            <AnimatePresence>
              {recommendation && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.35 }}
                  className="border-l-2 border-border pl-3 space-y-0.5"
                >
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Suggested
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed font-light">
                    {recommendation}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Dismiss */}
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              Dismiss
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
