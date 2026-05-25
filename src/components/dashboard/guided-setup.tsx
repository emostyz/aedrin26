'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { saveSetupAnswer, completeSetup } from '@/app/actions/setup'
import type { Domain } from '@/lib/supabase/types'

const QUESTIONS: { domain: Domain; q: string; ph: string }[] = [
  { domain: 'childhood', q: "What's an early memory that still feels vivid — and why do you think it stayed with you?", ph: 'I must have been seven…' },
  { domain: 'family',    q: 'Who shaped you most growing up, and what did they hand down to you — for better or worse?', ph: 'My grandmother…' },
  { domain: 'values',    q: "What's a line you won't cross, even when it costs you?", ph: "I've always believed…" },
  { domain: 'lessons',   q: "What's something you had to learn the hard way?", ph: 'It took me years to understand…' },
  { domain: 'beliefs',   q: 'When you imagine being gone someday, what do you hope was true about how you lived?', ph: "I'd want them to feel…" },
  { domain: 'messages',  q: "If the people you love could keep just one thing you've said, what would you want it to be?", ph: "I'd tell them…" },
]

export function GuidedSetup({ firstName }: { firstName: string }) {
  const [step, setStep] = useState(0)
  const [answer, setAnswer] = useState('')
  const [savedCount, setSavedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  const total = QUESTIONS.length
  const current = QUESTIONS[step]

  function finishOrAdvance() {
    setAnswer('')
    setError(null)
    if (step + 1 >= total) {
      startTransition(async () => {
        const res = await completeSetup()
        if (res.error) { setError(res.error); return }
        setDone(true)
      })
    } else {
      setStep((s) => s + 1)
    }
  }

  function handleSave() {
    const a = answer.trim()
    if (!a) { finishOrAdvance(); return }
    setError(null)
    startTransition(async () => {
      const res = await saveSetupAnswer(current.domain, a)
      if (res.error) { setError(res.error); return }
      setSavedCount((c) => c + 1)
      finishOrAdvance()
    })
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border/40 bg-surface/20 px-6 py-7 space-y-4">
        <div className="space-y-1.5">
          <p className="text-label">All done</p>
          <p className="text-[1.35rem] font-light tracking-[-0.02em] text-foreground leading-snug">
            {firstName ? `That's a beautiful start, ${firstName}.` : "That's a beautiful start."}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
            {savedCount > 0
              ? `You've captured ${savedCount} ${savedCount === 1 ? 'reflection' : 'reflections'}. From tomorrow, a single thoughtful question will be waiting for you each day — that's how your story gets written.`
              : 'From tomorrow, a single thoughtful question will be waiting for you each day — that\'s how your story gets written.'}
          </p>
          <p className="text-sm text-foreground pt-1">Come back tomorrow.</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 border-t border-border/30">
          <Link href="/app/interview" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Keep going in Capture →</Link>
          <Link href="/app/review" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Review your entries →</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-border rounded-xl p-6 space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-label">Set up your account</p>
          <p className="text-[11px] text-muted-foreground">{step + 1} of {total}</p>
        </div>
        <div className="h-px bg-border rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-foreground"
            initial={false}
            animate={{ width: `${(step / (total - 1)) * 100}%` }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="space-y-3"
        >
          <p className="text-[1.15rem] font-light tracking-[-0.01em] text-foreground leading-snug">{current.q}</p>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={current.ph}
            rows={4}
            autoFocus
            className="w-full bg-input border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
          />
        </motion.div>
      </AnimatePresence>

      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={finishOrAdvance}
          disabled={pending}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity ml-auto"
        >
          {pending ? 'Saving…' : step + 1 >= total ? 'Finish' : 'Save & continue'}
        </button>
      </div>
    </div>
  )
}
