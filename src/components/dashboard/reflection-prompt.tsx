'use client'

import Link from 'next/link'
import { useState } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'

type Prompt = { id: string; domain: string; text: string }

interface Props {
  prompts: Prompt[]
}

export function ReflectionPrompt({ prompts }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [idx, setIdx]             = useState(0)

  if (dismissed || prompts.length === 0) return null

  const prompt = prompts[idx % prompts.length]

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
          className="border border-border rounded-lg px-5 py-5 space-y-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-label">Reflect today</p>
              <p className="text-sm text-foreground leading-relaxed">
                {prompt.text}
              </p>
            </div>
            <button
              onClick={() => setDismissed(true)}
              aria-label="Dismiss prompt"
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="12" y1="2" x2="2" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href={`/app/interview/${prompt.domain}`}
              className="text-xs text-foreground underline underline-offset-2 hover:opacity-70 transition-opacity"
            >
              Respond →
            </Link>
            {prompts.length > 1 && (
              <button
                onClick={() => setIdx((i) => i + 1)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Another prompt
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
