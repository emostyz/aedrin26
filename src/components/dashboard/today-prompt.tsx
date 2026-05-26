'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { saveEntry } from '@/app/actions/entries'
import { suggestFollowUps } from '@/app/actions/ai'
import { SoundwaveRecorder } from '@/components/ui/soundwave-recorder'
import type { Domain, FollowUpQuestion } from '@/lib/supabase/types'

interface TodayPromptProps {
  promptId: string
  promptText: string
  domain: Domain
  existingEntry?: { content: string } | null
  autoWrite?: boolean
}

function CheckCircle() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="9" fill="currentColor" />
      <path d="M6 10l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EmptyCircle() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.25" className="text-border" />
    </svg>
  )
}

// ── Follow-up card ─────────────────────────────────────────────────────────────
function FollowUpCard({
  question, onSave, onDismiss, isPending,
}: {
  question: FollowUpQuestion
  onSave: (text: string) => void
  onDismiss: () => void
  isPending: boolean
}) {
  const [freeformValue, setFreeformValue] = useState('')
  const [choiceValue, setChoiceValue]     = useState<string | null>(null)
  const [showOther, setShowOther]         = useState(false)
  const [otherValue, setOtherValue]       = useState('')

  function handleSave() {
    if (question.type === 'freeform') {
      const val = freeformValue.trim()
      if (!val) return
      onSave(`${question.text}\n\n${val}`)
    } else {
      const val = showOther ? otherValue.trim() : choiceValue
      if (!val) return
      onSave(`${question.text}\n\n${val}`)
    }
  }

  const canSave =
    question.type === 'freeform'
      ? freeformValue.trim().length > 0
      : showOther ? otherValue.trim().length > 0 : choiceValue !== null

  return (
    <div className="border border-border rounded-xl p-5 space-y-4 bg-surface/40">
      <p className="text-sm text-foreground leading-relaxed font-light">{question.text}</p>

      {question.type === 'freeform' ? (
        <div className="space-y-2">
          <textarea
            autoFocus
            value={freeformValue}
            onChange={(e) => setFreeformValue(e.target.value)}
            placeholder={question.placeholder ?? 'Write your response…'}
            rows={3}
            className="w-full bg-input border border-border rounded-lg px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none transition-all"
          />
          <SoundwaveRecorder onTranscript={(t) => setFreeformValue(t)} canvasHeight={32} />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(question.options ?? []).map((opt) => (
              <motion.button
                key={opt}
                type="button"
                onClick={() => { setChoiceValue(opt); setShowOther(false) }}
                whileTap={{ scale: 0.96 }}
                className={`px-3.5 py-2 rounded-full text-xs border transition-all duration-200 ${
                  choiceValue === opt && !showOther
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                }`}
              >
                {opt}
              </motion.button>
            ))}
            <motion.button
              type="button"
              onClick={() => { setShowOther(true); setChoiceValue(null) }}
              whileTap={{ scale: 0.96 }}
              className={`px-3.5 py-2 rounded-full text-xs border transition-all duration-200 ${
                showOther
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
              }`}
            >
              Other…
            </motion.button>
          </div>
          <AnimatePresence>
            {showOther && (
              <motion.div
                key="other"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22 }}
                className="space-y-2 overflow-hidden"
              >
                <input
                  autoFocus
                  value={otherValue}
                  onChange={(e) => setOtherValue(e.target.value)}
                  placeholder="Tell me more…"
                  className="w-full bg-input border border-border rounded-md px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
                />
                <SoundwaveRecorder onTranscript={(t) => setOtherValue(t)} canvasHeight={28} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || isPending}
          className="bg-primary text-primary-foreground rounded-md px-3.5 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export function TodayPrompt({ promptId, promptText, domain, existingEntry, autoWrite }: TodayPromptProps) {
  const [phase, setPhase]               = useState<'idle' | 'writing' | 'saved'>(
    existingEntry ? 'saved' : (autoWrite ? 'writing' : 'idle')
  )
  const [content, setContent]           = useState('')
  const [savedContent, setSavedContent] = useState(existingEntry?.content ?? '')
  const [isPending, startT]             = useTransition()
  const [error, setError]               = useState<string | null>(null)
  const [followUp, setFollowUp]         = useState<FollowUpQuestion | null>(null)
  const [followUpDone, setFollowUpDone] = useState(false)

  const domainLabel = domain.charAt(0).toUpperCase() + domain.slice(1)
  const isDone = phase === 'saved'

  function handleSave() {
    if (!content.trim()) return
    setError(null)
    const text = content.trim()
    const fd = new FormData()
    fd.set('domain', domain)
    fd.set('content', text)
    fd.set('daily_prompt_id', promptId)

    startT(async () => {
      const result = await saveEntry(fd)
      if (result?.error) { setError(result.error); return }
      setSavedContent(text)
      setPhase('saved')
      suggestFollowUps(domain, text).then((qs) => {
        setFollowUp(qs[0] ?? null)
      })
    })
  }

  function handleFollowUpSave(answerText: string) {
    const fd = new FormData()
    fd.set('domain', domain)
    fd.set('content', answerText)
    fd.set('daily_prompt_id', promptId)
    startT(async () => {
      await saveEntry(fd)
      setFollowUp(null)
      setFollowUpDone(true)
    })
  }

  return (
    <div className={`border rounded-xl transition-colors duration-500 ${isDone ? 'border-border/40' : 'border-border'}`}>
      {/* ── Task header row ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-4">
        <span className={isDone ? 'text-foreground' : 'text-muted-foreground/60'}>
          {isDone ? <CheckCircle /> : <EmptyCircle />}
        </span>
        <p className={`text-sm font-medium flex-1 transition-colors ${isDone ? 'text-foreground/50 line-through decoration-foreground/20' : 'text-foreground'}`}>
          Today&apos;s reflection
        </p>
        <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2.5 py-1 shrink-0">
          {domainLabel}
        </span>
      </div>

      <div className="border-t border-border/40" />

      {/* ── Task body ────────────────────────────────────────────────── */}
      <div className="px-5 py-5 space-y-5">
        {/* The question — dimmed when answered */}
        <p className={`text-base sm:text-[1.1rem] font-light leading-relaxed tracking-[-0.01em] transition-colors duration-300 ${isDone ? 'text-foreground/35' : 'text-foreground'}`}>
          {promptText}
        </p>

        {/* Saved answer */}
        <AnimatePresence>
          {isDone && savedContent && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="border-l-2 border-foreground/20 pl-4"
            >
              <p className="text-sm text-foreground/70 leading-relaxed font-light">{savedContent}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Auto follow-up question */}
        <AnimatePresence>
          {isDone && followUp && !followUpDone && (
            <motion.div
              key="followup"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-3">
                <p className="text-label">One more thing</p>
                <div className="flex-1 h-px bg-border" />
              </div>
              <FollowUpCard
                question={followUp}
                onSave={handleFollowUpSave}
                onDismiss={() => { setFollowUp(null); setFollowUpDone(true) }}
                isPending={isPending}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Writing area */}
        <AnimatePresence>
          {phase === 'writing' && (
            <motion.div
              key="writing"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
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
              <SoundwaveRecorder onTranscript={(t) => setContent(t)} disabled={isPending} canvasHeight={40} />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!content.trim() || isPending}
                  className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
                >
                  {isPending ? 'Saving…' : 'Save reflection'}
                </button>
                <button
                  type="button"
                  onClick={() => { setPhase('idle'); setContent('') }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action row */}
        {phase === 'idle' && (
          <div className="flex items-center gap-4 flex-wrap">
            <button
              type="button"
              onClick={() => setPhase('writing')}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Write your reflection
            </button>
            <Link
              href={`/app/interview/${domain}`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Open in Capture →
            </Link>
          </div>
        )}

        {isDone && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 border-t border-border/40">
            <Link href={`/app/interview/${domain}`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              More {domainLabel.toLowerCase()} questions →
            </Link>
            <Link href="/app/review" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Review all entries →
            </Link>
            <Link href="/app/interview" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Explore other topics →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
