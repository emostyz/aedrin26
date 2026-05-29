'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { saveEntry } from '@/app/actions/entries'
import { getLifeReviewChapter } from '@/app/actions/life-review'
import type { LifeReviewQuestion, LifeReviewChapterId } from '@/app/actions/life-review'
import type { Domain } from '@/lib/supabase/types'

// ── Chapter definitions ──────────────────────────────────────────────────────

interface ChapterDef {
  id: LifeReviewChapterId
  label: string
  years: string
  tagline: string
  domain: Domain
}

const CHAPTERS: ChapterDef[] = [
  { id: 'early',      label: 'Early life',      years: '0–12',        tagline: 'Before the world had its say.',  domain: 'childhood' },
  { id: 'teen',       label: 'Teen years',       years: '13–18',       tagline: 'When everything felt urgent.',   domain: 'childhood' },
  { id: 'young',      label: 'Early adulthood',  years: '19–30',       tagline: 'The years of becoming.',         domain: 'career'    },
  { id: 'middle',     label: 'Middle years',     years: '31–50',       tagline: 'What you built and why.',        domain: 'family'    },
  { id: 'later',      label: 'Later life',       years: '51–70',       tagline: 'When things came into focus.',   domain: 'lessons'   },
  { id: 'reflection', label: 'Reflection',       years: 'Looking back', tagline: 'What it all adds up to.',       domain: 'values'    },
]

// ── Types ───────────────────────────────────────────────────────────────────

type Phase =
  | { name: 'grid' }
  | { name: 'intro'; chapter: ChapterDef }
  | { name: 'qa'; chapter: ChapterDef; questions: LifeReviewQuestion[] }
  | { name: 'complete'; chapter: ChapterDef; savedCount: number }

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  displayName: string | null
  entriesByDomain: Record<string, number>   // domain → count of existing entries
}

// ── Chapter card ─────────────────────────────────────────────────────────────

function ChapterCard({
  chapter,
  entryCount,
  onClick,
}: {
  chapter: ChapterDef
  entryCount: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left border border-border rounded-xl px-5 py-5 hover:border-foreground/20 hover:bg-surface/30 transition-all duration-200 space-y-3"
    >
      <div className="space-y-0.5">
        <p className="text-base font-light text-foreground leading-snug">{chapter.label}</p>
        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{chapter.years}</p>
      </div>
      <p className="text-xs text-muted-foreground italic leading-relaxed">{chapter.tagline}</p>
      <p className="text-[10px] text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
        {entryCount > 0
          ? `${entryCount} ${entryCount === 1 ? 'memory' : 'memories'} written`
          : 'Begin →'}
      </p>
    </button>
  )
}

// ── Q&A phase ────────────────────────────────────────────────────────────────

function QuestionView({
  chapter,
  questions,
  onComplete,
}: {
  chapter: ChapterDef
  questions: LifeReviewQuestion[]
  onComplete: (savedCount: number) => void
}) {
  const [index, setIndex]             = useState(0)
  const [direction, setDirection]     = useState<'forward' | 'back'>('forward')
  const [content, setContent]         = useState('')
  const [savedCount, setSavedCount]   = useState(0)
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set())
  const [justSaved, setJustSaved]     = useState(false)
  const [showHint, setShowHint]       = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()

  const current = questions[index]
  const isLast  = index === questions.length - 1

  function advance(dir: 'forward' | 'back') {
    setDirection(dir)
    setIndex((i) => (dir === 'forward' ? i + 1 : i - 1))
    setContent('')
    setJustSaved(false)
    setShowHint(false)
    setError(null)
  }

  function handleSave() {
    if (!content.trim() || !current) return
    setError(null)
    const fd = new FormData()
    fd.set('domain', chapter.domain)
    fd.set('content', content.trim())

    startTransition(async () => {
      const result = await saveEntry(fd)
      if (result?.error) { setError(result.error); return }
      const newCount = savedCount + 1
      setSavedCount(newCount)
      setSavedIndices((prev) => new Set([...prev, index]))
      setJustSaved(true)
      setContent('')

      // Auto-advance after a brief saved confirmation
      setTimeout(() => {
        setJustSaved(false)
        if (isLast) {
          onComplete(newCount)
        } else {
          advance('forward')
        }
      }, 900)
    })
  }

  function handleSkip() {
    if (isLast) {
      onComplete(savedCount)
    } else {
      advance('forward')
    }
  }

  if (!current) return null

  const isSaved = savedIndices.has(index)

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-2 text-xs text-muted-foreground"
      >
        <Link href="/app/interview" className="hover:text-foreground transition-colors">Capture</Link>
        <span>/</span>
        <button
          type="button"
          onClick={() => onComplete(savedCount)}
          className="hover:text-foreground transition-colors"
        >
          Life review
        </button>
        <span>/</span>
        <span className="text-foreground">{chapter.label}</span>
      </motion.div>

      {/* Chapter label + progress */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-label text-muted-foreground">Life review</p>
            <p className="text-sm text-foreground font-light">{chapter.label} · {chapter.years}</p>
          </div>
          <p className="text-[10px] text-muted-foreground tabular-nums">{index + 1} / {questions.length}</p>
        </div>

        {/* Progress bar */}
        <div className="h-px bg-border rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-foreground/40 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((index + (isSaved ? 1 : 0)) / questions.length) * 100}%` }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          />
        </div>
      </motion.div>

      {/* Question */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${index}-${direction}`}
          initial={{ opacity: 0, x: direction === 'forward' ? 28 : -28 }}
          animate={{ opacity: 1, x: 0, transition: { duration: 0.32, ease: [0.25, 0.1, 0.25, 1] } }}
          exit={{ opacity: 0, x: direction === 'forward' ? -28 : 28, transition: { duration: 0.2 } }}
          className="space-y-4"
        >
          <p className={`text-[1.2rem] font-light leading-relaxed tracking-[-0.01em] transition-colors ${justSaved ? 'text-foreground/40' : 'text-foreground'}`}>
            {current.text}
          </p>

          {/* Hint toggle */}
          <AnimatePresence>
            {!showHint && !justSaved && (
              <motion.button
                key="hint-btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                type="button"
                onClick={() => setShowHint(true)}
                className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                Need a hint?
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showHint && (
              <motion.div
                key="hint"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-3 py-1">
                  {current.hint}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* Saved confirmation or input */}
      <AnimatePresence mode="wait">
        {justSaved ? (
          <motion.div
            key="saved"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <span className="text-foreground">Saved</span>
            <span>·</span>
            <span>{isLast ? 'finishing chapter…' : 'moving to next question…'}</span>
          </motion.div>
        ) : (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.08, duration: 0.3 } }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.18 } }}
            className="space-y-3"
          >
            <div className="relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your response…"
                rows={6}
                aria-label="Your response"
                className="w-full bg-input border border-border rounded-lg px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none transition-all"
              />
              {content.trim() && (
                <span className="absolute bottom-2.5 right-3 text-[10px] text-muted-foreground/40 select-none pointer-events-none">
                  {content.trim().split(/\s+/).filter(Boolean).length}w
                </span>
              )}
            </div>

            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={!content.trim() || isPending}
                className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>

              <button
                type="button"
                onClick={handleSkip}
                disabled={isPending}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
              >
                {isLast ? 'Finish chapter' : 'Skip →'}
              </button>

              {index > 0 && (
                <button
                  type="button"
                  onClick={() => advance('back')}
                  disabled={isPending}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                >
                  ← Back
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Complete state ────────────────────────────────────────────────────────────

function ChapterComplete({
  chapter,
  savedCount,
  onReturnToGrid,
}: {
  chapter: ChapterDef
  savedCount: number
  onReturnToGrid: () => void
}) {
  const currentIndex = CHAPTERS.findIndex((c) => c.id === chapter.id)
  const nextChapter  = CHAPTERS[currentIndex + 1] ?? null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/app/interview" className="hover:text-foreground transition-colors">Capture</Link>
        <span>/</span>
        <button type="button" onClick={onReturnToGrid} className="hover:text-foreground transition-colors">Life review</button>
        <span>/</span>
        <span className="text-foreground">{chapter.label}</span>
      </div>

      <div className="border border-border rounded-xl px-6 py-10 text-center space-y-4">
        <p className="text-label text-muted-foreground">Chapter complete</p>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          {chapter.label}
        </p>
        {savedCount > 0 ? (
          <p className="text-sm text-muted-foreground">
            {savedCount} {savedCount === 1 ? 'memory' : 'memories'} saved from {chapter.years}.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            You can always return to this chapter later.
          </p>
        )}
      </div>

      <div className="space-y-2">
        {nextChapter && (
          <button
            type="button"
            onClick={onReturnToGrid}
            className="group flex items-center justify-between w-full border border-border rounded-xl px-5 py-4 hover:border-foreground/20 hover:bg-surface/30 transition-all duration-200"
          >
            <div className="space-y-0.5 text-left">
              <p className="text-xs text-muted-foreground">Next chapter</p>
              <p className="text-sm text-foreground font-light">{nextChapter.label}</p>
              <p className="text-xs text-muted-foreground/60 italic">{nextChapter.tagline}</p>
            </div>
            <p className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground transition-colors shrink-0 ml-6">
              Continue →
            </p>
          </button>
        )}

        <button
          type="button"
          onClick={onReturnToGrid}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-3"
        >
          {nextChapter ? 'Or return to all chapters' : 'Return to all chapters'}
        </button>
      </div>
    </motion.div>
  )
}

// ── Main client component ─────────────────────────────────────────────────────

export function LifeReviewClient({ displayName, entriesByDomain }: Props) {
  const [phase, setPhase] = useState<Phase>({ name: 'grid' })
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function selectChapter(chapter: ChapterDef) {
    setLoadError(null)
    setPhase({ name: 'intro', chapter })
  }

  function loadQuestions(chapter: ChapterDef) {
    setLoadError(null)
    startTransition(async () => {
      const result = await getLifeReviewChapter(chapter.id)
      if (result.error || result.questions.length === 0) {
        setLoadError(result.error ?? 'Could not load questions. Please try again.')
        return
      }
      setPhase({ name: 'qa', chapter, questions: result.questions })
    })
  }

  function handleComplete(chapter: ChapterDef, savedCount: number) {
    setPhase({ name: 'complete', chapter, savedCount })
  }

  // ── Grid ──────────────────────────────────────────────────────────────────

  if (phase.name === 'grid') {
    return (
      <div className="space-y-8">
        <div className="space-y-3">
          <p className="text-label">Life review</p>
          <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
            Your life, chapter by chapter.
          </p>
          <p className="text-sm text-muted-foreground">
            A structured journey through every decade. Unlike the daily prompts, this is designed to be
            completed over multiple sessions — working through each chapter until you feel you&apos;ve said what matters.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {CHAPTERS.map((chapter) => (
            <ChapterCard
              key={chapter.id}
              chapter={chapter}
              entryCount={entriesByDomain[chapter.domain] ?? 0}
              onClick={() => selectChapter(chapter)}
            />
          ))}
        </div>
      </div>
    )
  }

  // ── Intro ─────────────────────────────────────────────────────────────────

  if (phase.name === 'intro') {
    const { chapter } = phase
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/app/interview" className="hover:text-foreground transition-colors">Capture</Link>
          <span>/</span>
          <button
            type="button"
            onClick={() => { setPhase({ name: 'grid' }); setLoadError(null) }}
            className="hover:text-foreground transition-colors"
          >
            Life review
          </button>
          <span>/</span>
          <span className="text-foreground">{chapter.label}</span>
        </div>

        <div className="space-y-3">
          <p className="text-label text-muted-foreground">{chapter.years}</p>
          <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
            {chapter.label}
          </p>
          <p className="text-sm text-muted-foreground italic">{chapter.tagline}</p>
        </div>

        <div className="border border-border rounded-xl px-6 py-6 space-y-4 bg-surface/20">
          <p className="text-sm text-foreground/80 leading-relaxed font-light">
            The AI will generate 5 questions tailored to{displayName ? ` ${displayName}'s` : ' your'} life and this specific period.
            Take as long as you need on each one — there&apos;s no rush.
          </p>
          <p className="text-xs text-muted-foreground">
            Answers are saved to your{' '}
            <span className="capitalize">{chapter.domain}</span> collection.
            You can edit them anytime in Review.
          </p>
        </div>

        {loadError && (
          <p role="alert" className="text-xs text-destructive">{loadError}</p>
        )}

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => loadQuestions(chapter)}
            disabled={isPending}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
          >
            {isPending ? 'Loading questions…' : 'Load questions →'}
          </button>

          <button
            type="button"
            onClick={() => { setPhase({ name: 'grid' }); setLoadError(null) }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Choose a different chapter
          </button>
        </div>
      </motion.div>
    )
  }

  // ── Q&A ───────────────────────────────────────────────────────────────────

  if (phase.name === 'qa') {
    const { chapter, questions } = phase
    return (
      <QuestionView
        chapter={chapter}
        questions={questions}
        onComplete={(savedCount) => handleComplete(chapter, savedCount)}
      />
    )
  }

  // ── Complete ──────────────────────────────────────────────────────────────

  if (phase.name === 'complete') {
    const { chapter, savedCount } = phase
    return (
      <ChapterComplete
        chapter={chapter}
        savedCount={savedCount}
        onReturnToGrid={() => setPhase({ name: 'grid' })}
      />
    )
  }

  return null
}
