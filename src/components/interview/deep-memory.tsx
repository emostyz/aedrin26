'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { saveEntry } from '@/app/actions/entries'
import type { Domain } from '@/lib/supabase/types'

interface Props {
  initialDomain?: Domain
  onSaved?: () => void
  onClose: () => void
}

const DOMAINS: { domain: Domain; label: string; dot: string }[] = [
  { domain: 'childhood', label: 'Childhood', dot: 'bg-amber-400' },
  { domain: 'family',    label: 'Family',    dot: 'bg-rose-400'  },
  { domain: 'career',    label: 'Career',    dot: 'bg-blue-400'  },
  { domain: 'values',    label: 'Values',    dot: 'bg-emerald-400' },
  { domain: 'beliefs',   label: 'Beliefs',   dot: 'bg-violet-400' },
  { domain: 'lessons',   label: 'Lessons',   dot: 'bg-orange-400' },
  { domain: 'messages',  label: 'Messages',  dot: 'bg-teal-400'  },
  { domain: 'other',     label: 'Other',     dot: 'bg-muted-foreground' },
]

const STEPS = [
  {
    id: 'scene',
    number: 1,
    label: 'Set the scene',
    question: 'When and where does this memory take place?',
    placeholder: 'e.g. "Summer of 1987, in the kitchen of our house in Vermont…"',
    hint: 'Be specific — a year, a season, a place. Ground the memory in time and space.',
    minWords: 3,
  },
  {
    id: 'story',
    number: 2,
    label: 'Tell the story',
    question: 'What happened? Walk me through it.',
    placeholder: 'Tell the story in your own words, as if you\'re telling it to a friend…',
    hint: 'Include sensory details — what you saw, heard, felt. The small things make memories real.',
    minWords: 10,
  },
  {
    id: 'meaning',
    number: 3,
    label: 'The meaning',
    question: 'Why does this memory stay with you?',
    placeholder: 'What did it teach you? How did it shape who you are?',
    hint: 'This is what will matter most to the people who read your story.',
    minWords: 5,
  },
]

export function DeepMemory({ initialDomain, onSaved, onClose }: Props) {
  const [domain, setDomain] = useState<Domain>(initialDomain ?? 'childhood')
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({ scene: '', story: '', meaning: '' })
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const currentStep = STEPS[step]!
  const currentAnswer = answers[currentStep.id] ?? ''
  const wordCount = currentAnswer.trim().split(/\s+/).filter(Boolean).length
  const canAdvance = wordCount >= currentStep.minWords

  // Auto-focus textarea on step change
  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 100)
    return () => clearTimeout(t)
  }, [step])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function updateAnswer(val: string) {
    setAnswers((prev) => ({ ...prev, [currentStep.id]: val }))
  }

  function handleNext() {
    if (!canAdvance) return
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1)
    } else {
      handleSave()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleNext()
    }
  }

  function handleSave() {
    setError(null)
    const combined = [
      answers.scene?.trim(),
      answers.story?.trim(),
      answers.meaning?.trim(),
    ].filter(Boolean).join('\n\n')

    if (!combined) return

    const fd = new FormData()
    fd.set('domain', domain)
    fd.set('content', combined)

    startTransition(async () => {
      const result = await saveEntry(fd)
      if (result?.error) { setError(result.error); return }
      setDone(true)
      onSaved?.()
    })
  }

  const totalWordCount = Object.values(answers).reduce(
    (sum, a) => sum + (a?.trim().split(/\s+/).filter(Boolean).length ?? 0), 0
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-lg bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        {done ? (
          /* ── Done state ── */
          <div className="px-8 py-10 text-center space-y-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <p className="text-2xl">✓</p>
            </motion.div>
            <div className="space-y-1">
              <p className="text-sm text-foreground">Memory saved.</p>
              <p className="text-xs text-muted-foreground">
                {totalWordCount} words captured · {DOMAINS.find((d) => d.domain === domain)?.label} chapter
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-foreground">Deep memory</p>
                <p className="text-[10px] text-muted-foreground">3 questions · richer story</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* ── Domain picker (only shown on step 0) ── */}
            <AnimatePresence>
              {step === 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-b border-border/30"
                >
                  <div className="px-6 py-3 flex gap-2 flex-wrap">
                    {DOMAINS.map(({ domain: d, label, dot }) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDomain(d)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] border transition-all ${
                          domain === d
                            ? 'border-foreground/20 bg-surface/60 text-foreground'
                            : 'border-border text-muted-foreground hover:border-foreground/15 hover:text-foreground'
                        }`}
                      >
                        <span className={`w-1 h-1 rounded-full ${dot}`} />
                        {label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Progress bar ── */}
            <div className="h-0.5 bg-border/30">
              <motion.div
                className="h-full bg-foreground/40"
                animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              />
            </div>

            {/* ── Step content ── */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                className="px-6 py-6 space-y-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                      Step {currentStep.number} of {STEPS.length}
                    </span>
                    <span className="text-[10px] text-muted-foreground/30">·</span>
                    <span className="text-[10px] text-muted-foreground/50">{currentStep.label}</span>
                  </div>
                  <p className="text-base font-light text-foreground leading-snug">
                    {currentStep.question}
                  </p>
                  <p className="text-[11px] text-muted-foreground/60">{currentStep.hint}</p>
                </div>

                <textarea
                  ref={textareaRef}
                  value={currentAnswer}
                  onChange={(e) => updateAnswer(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={currentStep.placeholder}
                  rows={4}
                  className="w-full bg-input border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring resize-none transition-all"
                />

                {error && <p className="text-xs text-destructive">{error}</p>}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {step > 0 && (
                      <button
                        type="button"
                        onClick={() => setStep((s) => s - 1)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        ← Back
                      </button>
                    )}
                    {wordCount > 0 && (
                      <span className="text-[10px] text-muted-foreground/40">{wordCount}w</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!canAdvance || isPending}
                    className="flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
                  >
                    {isPending
                      ? 'Saving…'
                      : step < STEPS.length - 1
                        ? 'Next →'
                        : 'Save memory'}
                    {!isPending && (
                      <span className="text-primary-foreground/50 text-[10px]">⌘↵</span>
                    )}
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Previous answers summary */}
            {step > 0 && (
              <div className="px-6 pb-4 space-y-2 border-t border-border/20 pt-3">
                {STEPS.slice(0, step).map((s) => {
                  const ans = answers[s.id]
                  if (!ans?.trim()) return null
                  return (
                    <div key={s.id} className="space-y-0.5">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground/40">{s.label}</p>
                      <p className="text-[11px] text-muted-foreground/70 line-clamp-1 font-light">{ans.trim()}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  )
}
