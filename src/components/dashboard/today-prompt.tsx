'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, Stagger, StaggerItem } from '@/components/ui/motion'
import { saveEntry } from '@/app/actions/entries'
import { suggestFollowUps } from '@/app/actions/ai'
import { SoundwaveRecorder } from '@/components/ui/soundwave-recorder'
import type { Domain, FollowUpQuestion } from '@/lib/supabase/types'

interface TodayPromptProps {
  promptId: string
  promptText: string
  domain: Domain
}

// ── Follow-up card (choice or freeform) ───────────────────────────────────────
function FollowUpCard({
  question,
  onSave,
  onDismiss,
  isPending,
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
// phase: idle → writing → saved → (auto follow-up shown inline if generated)
export function TodayPrompt({ promptId, promptText, domain }: TodayPromptProps) {
  const [phase, setPhase]               = useState<'idle' | 'writing' | 'saved'>('idle')
  const [content, setContent]           = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [isPending, startT]             = useTransition()
  const [error, setError]               = useState<string | null>(null)
  // Auto-generated follow-up (fires after save, only if relevant)
  const [followUp, setFollowUp]         = useState<FollowUpQuestion | null>(null)
  const [followUpDone, setFollowUpDone] = useState(false)

  const domainLabel = domain.charAt(0).toUpperCase() + domain.slice(1)

  function handleSave() {
    if (!content.trim()) return
    setError(null)
    const text = content.trim()
    const fd = new FormData()
    fd.set('domain', domain)
    fd.set('content', text)
    // Use daily_prompt_id — daily prompts live in a separate table from interview_prompts
    fd.set('daily_prompt_id', promptId)

    startT(async () => {
      const result = await saveEntry(fd)
      if (result?.error) { setError(result.error); return }
      setSavedContent(text)
      setPhase('saved')

      // Fire-and-forget: generate one follow-up question if relevant
      suggestFollowUps(domain, text).then((qs) => {
        const top = qs[0] ?? null
        setFollowUp(top)
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
    <div className="border border-border rounded-xl p-6 sm:p-8 space-y-6">
      {/* Label row */}
      <div className="flex items-center justify-between">
        <p className="text-label">Today&apos;s reflection</p>
        <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2.5 py-1">
          {domainLabel}
        </span>
      </div>

      {/* Prompt text / saved confirmation */}
      <AnimatePresence mode="wait">
        {phase !== 'saved' ? (
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
          <motion.p
            key="saved"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="text-sm font-light text-muted-foreground italic leading-relaxed line-clamp-4"
          >
            &ldquo;{savedContent}&rdquo;
          </motion.p>
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

            <SoundwaveRecorder
              onTranscript={(t) => setContent(t)}
              disabled={isPending}
              canvasHeight={40}
            />

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

      {/* Auto follow-up question — shown after save if AI thinks one is relevant */}
      <AnimatePresence>
        {phase === 'saved' && followUp && !followUpDone && (
          <motion.div
            key="followup"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-4"
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

      {/* Idle action row */}
      {phase === 'idle' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-4"
        >
          <button
            type="button"
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

      {/* Saved action row */}
      {phase === 'saved' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-wrap items-center gap-4 pt-2 border-t border-border"
        >
          <Link
            href={`/app/interview/${domain}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            More {domainLabel.toLowerCase()} questions →
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
