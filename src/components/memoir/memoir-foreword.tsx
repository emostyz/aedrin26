'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { generateMemoirForeword } from '@/app/actions/memoir-foreword'

interface Props {
  displayName: string | null
}

export function MemoirForeword({ displayName }: Props) {
  const [foreword, setForeword] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleGenerate() {
    setError(null)
    startTransition(async () => {
      const result = await generateMemoirForeword()
      if (result.error || !result.foreword) {
        setError(result.error ?? 'Could not generate foreword.')
        return
      }
      setForeword(result.foreword)
    })
  }

  function handleCopy() {
    if (!foreword) return
    navigator.clipboard.writeText(foreword).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleRegenerate() {
    setForeword(null)
    handleGenerate()
  }

  if (!foreword) {
    return (
      <div className="border border-dashed border-border rounded-xl px-6 py-8 space-y-4 text-center">
        <div className="space-y-1.5">
          <p className="text-sm font-light text-foreground">Generate your foreword</p>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
            Let AI write the opening of your memoir — a dignified introduction that gives your loved ones a sense of who you were at your core.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {isPending ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-foreground/30"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Writing your foreword…</p>
            </motion.div>
          ) : (
            <motion.button
              key="generate"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              type="button"
              onClick={handleGenerate}
              className="bg-foreground text-background rounded-lg px-5 py-2.5 text-sm font-light hover:opacity-90 transition-opacity"
            >
              ✦ Generate foreword
            </motion.button>
          )}
        </AnimatePresence>

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-label">Foreword</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={isPending}
            className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground disabled:opacity-40 transition-colors"
          >
            {isPending ? 'Writing…' : 'Regenerate'}
          </button>
        </div>
      </div>

      {/* The foreword */}
      <div className="relative border border-border/40 rounded-xl bg-surface/10 px-7 py-6 space-y-4">
        {/* Decorative quote mark */}
        <div className="absolute top-4 left-5 text-4xl text-foreground/8 font-serif select-none pointer-events-none" aria-hidden>
          ❝
        </div>

        <p className="text-sm font-light leading-[1.95] text-foreground/85 whitespace-pre-wrap italic pl-2">
          {foreword}
        </p>

        <div className="flex items-center gap-2 pt-2 border-t border-border/30">
          <div className="flex-1 h-px bg-border/20" />
          <p className="text-[10px] text-muted-foreground/40">
            AI-generated foreword · {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
          </p>
          <div className="flex-1 h-px bg-border/20" />
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/40 text-center">
        This foreword is generated fresh each time. You can copy it and save it elsewhere, or regenerate as your story grows.
      </p>
    </motion.div>
  )
}
