'use client'

import { useState, useTransition } from 'react'
import { generateWritingSparks } from '@/app/actions/writing-sparks'
import { motion, AnimatePresence } from '@/components/ui/motion'
import type { Domain } from '@/lib/supabase/types'

interface Props {
  domain: Domain
  onSelectPrompt: (text: string) => void
}

export function WritingSparks({ domain, onSelectPrompt }: Props) {
  const [open, setOpen] = useState(false)
  const [sparks, setSparks] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function fetchSparks() {
    setError(null)
    startTransition(async () => {
      const result = await generateWritingSparks(domain)
      if (result.error || !result.sparks) {
        setError(result.error ?? 'Could not generate prompts')
        return
      }
      setSparks(result.sparks)
    })
  }

  function handleOpen() {
    if (!open) {
      setOpen(true)
      if (!sparks) fetchSparks()
    } else {
      setOpen(false)
    }
  }

  function handleRefresh() {
    setSparks(null)
    fetchSparks()
  }

  function handleSelect(text: string) {
    onSelectPrompt(text)
    setOpen(false)
  }

  return (
    <div className="space-y-2">
      {/* Toggle button */}
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="text-[11px]">✦</span>
        <span>Writing sparks</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[10px] leading-none"
        >
          ›
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="sparks-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-2 space-y-2">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  ✦ Writing sparks
                </p>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isPending}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors disabled:opacity-30"
                  aria-label="Refresh sparks"
                >
                  <motion.span
                    animate={{ rotate: isPending ? 360 : 0 }}
                    transition={
                      isPending
                        ? { duration: 0.8, repeat: Infinity, ease: 'linear' }
                        : { duration: 0 }
                    }
                    className="inline-block"
                  >
                    ↻
                  </motion.span>
                  <span>Refresh</span>
                </button>
              </div>

              {/* Loading state */}
              {isPending && !sparks && (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border/40 px-4 py-3 animate-pulse bg-surface/20"
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      <div className="h-3 rounded bg-border/40 w-3/4" />
                    </div>
                  ))}
                </div>
              )}

              {/* Error state */}
              {error && !isPending && (
                <p className="text-xs text-destructive">{error}</p>
              )}

              {/* Spark cards */}
              {sparks && !isPending && (
                <div className="space-y-2">
                  {sparks.map((spark, idx) => (
                    <motion.button
                      key={`${spark}-${idx}`}
                      type="button"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: idx * 0.06 }}
                      onClick={() => handleSelect(spark)}
                      className="w-full text-left rounded-xl border border-border px-4 py-3 text-sm font-light text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors duration-150"
                    >
                      {spark}
                    </motion.button>
                  ))}
                </div>
              )}

              <p className="text-[10px] text-muted-foreground/40">
                Click a spark to use it as your starting point.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
