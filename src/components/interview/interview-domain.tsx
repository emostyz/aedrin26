'use client'

import { useState, useRef, useTransition, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { saveEntry } from '@/app/actions/entries'
import { suggestFollowUps } from '@/app/actions/ai'
import { motion, AnimatePresence, Stagger, StaggerItem } from '@/components/ui/motion'
import type { Domain, Database, FollowUpQuestion } from '@/lib/supabase/types'

type Prompt = Database['public']['Tables']['interview_prompts']['Row']
type Entry  = Database['public']['Tables']['soul_entries']['Row']

interface Props {
  domain: Domain
  label: string
  prompts: Prompt[]
  existingEntries: Entry[]
  dailyPrompt?: { id: string; prompt_text: string } | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

type SpeechRecognition = EventTarget & {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((e: Event) => void) | null
}

type SpeechRecognitionEvent = Event & {
  results: SpeechRecognitionResultList
}

type SpeechRecognitionResultList = {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

type SpeechRecognitionResult = {
  isFinal: boolean
  [index: number]: SpeechRecognitionAlternative
}

type SpeechRecognitionAlternative = { transcript: string }

// ── Follow-up Question UI ──────────────────────────────────────────────────────

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
  const [choiceOther, setChoiceOther]     = useState('')
  const [showOther, setShowOther]         = useState(false)

  function handleSave() {
    if (question.type === 'freeform') {
      if (!freeformValue.trim()) return
      onSave(`${question.text}\n\n${freeformValue.trim()}`)
    } else {
      const val = showOther ? choiceOther.trim() : choiceValue
      if (!val) return
      onSave(`${question.text}\n\n${val}`)
    }
  }

  const canSave =
    question.type === 'freeform'
      ? freeformValue.trim().length > 0
      : showOther
        ? choiceOther.trim().length > 0
        : choiceValue !== null

  return (
    <div className="border border-border rounded-xl p-5 space-y-4">
      <p className="text-sm text-foreground leading-relaxed font-light">{question.text}</p>

      {question.type === 'freeform' ? (
        <textarea
          autoFocus
          value={freeformValue}
          onChange={(e) => setFreeformValue(e.target.value)}
          placeholder={question.placeholder ?? 'Write your response…'}
          rows={3}
          className="w-full bg-input border border-border rounded-lg px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none transition-all"
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(question.options ?? []).map((opt) => (
              <motion.button
                key={opt}
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
              <motion.input
                key="other-input"
                autoFocus
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22 }}
                value={choiceOther}
                onChange={(e) => setChoiceOther(e.target.value)}
                placeholder="Tell me more…"
                className="w-full bg-input border border-border rounded-md px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
              />
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!canSave || isPending}
          className="bg-primary text-primary-foreground rounded-md px-3.5 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onDismiss}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function InterviewDomain({ domain, label, prompts, existingEntries, dailyPrompt }: Props) {
  // Merge daily prompt at the front if present and not already in prompts
  const effectivePrompts = (() => {
    if (!dailyPrompt) return prompts
    const isDuplicate = prompts.some((p) => p.id === dailyPrompt.id)
    if (isDuplicate) return prompts
    const synthetic = {
      id: dailyPrompt.id,
      domain,
      text: dailyPrompt.prompt_text,
      version: 1,
      ord: 0,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } satisfies Prompt
    return [synthetic, ...prompts]
  })()

  const [promptIndex, setPromptIndex]       = useState(0)
  const [direction, setDirection]           = useState<'forward' | 'back'>('forward')
  const [entries, setEntries]               = useState<Entry[]>(existingEntries)
  const [content, setContent]               = useState('')
  const [error, setError]                   = useState<string | null>(null)
  const [savedBrief, setSavedBrief]         = useState(false)
  const [followUps, setFollowUps]           = useState<FollowUpQuestion[]>([])
  const [loadingFollowUps, setLoadingFollowUps] = useState(false)
  const [isListening, setIsListening]       = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [uploadedFile, setUploadedFile]     = useState<{ name: string; url: string } | null>(null)
  const [uploading, setUploading]           = useState(false)
  const [isPending, startTransition]        = useTransition()
  const recognitionRef                      = useRef<SpeechRecognition | null>(null)
  const fileInputRef                        = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    setVoiceSupported(!!SR)
  }, [])

  const currentPrompt = effectivePrompts[promptIndex] ?? null
  const hasNext = promptIndex < effectivePrompts.length - 1
  const hasPrev = promptIndex > 0
  const isDaily = dailyPrompt && currentPrompt?.id === dailyPrompt.id

  function advance(dir: 'forward' | 'back') {
    setDirection(dir)
    setPromptIndex((i) => dir === 'forward' ? i + 1 : i - 1)
    setContent('')
    setFollowUps([])
    setSavedBrief(false)
    setError(null)
    setUploadedFile(null)
  }

  function startListening() {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    recognitionRef.current = rec

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let transcript = ''
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript
      }
      setContent(transcript)
    }
    rec.onend = () => setIsListening(false)
    rec.onerror = () => setIsListening(false)
    rec.start()
    setIsListening(true)
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    const fd = new FormData()
    fd.set('file', file)
    const res = await fetch('/api/artifacts', { method: 'POST', body: fd })
    const json = await res.json()
    setUploading(false)
    if (json.error) { setError(json.error); return }
    setUploadedFile({ name: json.name, url: json.url })
  }

  function doSave(text: string, mediaUrl?: string) {
    if (!text.trim()) return
    setError(null)
    const fd = new FormData()
    fd.set('domain', domain)
    fd.set('content', text.trim())
    if (currentPrompt) fd.set('prompt_id', currentPrompt.id)
    if (mediaUrl) fd.set('media_url', mediaUrl)

    startTransition(async () => {
      const result = await saveEntry(fd)
      if (result?.error) { setError(result.error); return }
      setEntries((prev) => [{
        id: crypto.randomUUID(), user_id: '', domain,
        prompt_id: currentPrompt?.id ?? null,
        content: text.trim(),
        media_url: mediaUrl ?? null,
        sharing_status: 'private', bound_recipient_id: null, source: 'typed',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, ...prev])
      setContent('')
      setFollowUps([])
      setUploadedFile(null)
      setSavedBrief(true)
      setTimeout(() => setSavedBrief(false), 2000)
    })
  }

  async function handleDeepen() {
    if (!content.trim()) return
    setLoadingFollowUps(true)
    setFollowUps([])
    const result = await suggestFollowUps(domain, content.trim())
    setFollowUps(result)
    setLoadingFollowUps(false)
  }

  function dismissFollowUp(index: number) {
    setFollowUps((prev) => prev.filter((_, i) => i !== index))
  }

  function saveFollowUp(index: number, text: string) {
    doSave(text)
    setFollowUps((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-14">
      {/* Breadcrumb */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-2 text-xs text-muted-foreground"
      >
        <Link href="/app/interview" className="hover:text-foreground transition-colors">Capture</Link>
        <span>/</span>
        <span className="text-foreground">{label}</span>
        {isDaily && (
          <>
            <span>/</span>
            <span className="text-foreground">Today</span>
          </>
        )}
      </motion.div>

      {/* Question */}
      {currentPrompt ? (
        <div className="space-y-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${promptIndex}-${direction}`}
              initial={{ opacity: 0, x: direction === 'forward' ? 28 : -28 }}
              animate={{ opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } }}
              exit={{ opacity: 0, x: direction === 'forward' ? -28 : 28, transition: { duration: 0.22 } }}
              className="space-y-3"
            >
              {isDaily && (
                <p className="text-label">Today&apos;s reflection</p>
              )}
              {!isDaily && (
                <p className="text-label">{promptIndex + 1} / {effectivePrompts.length}</p>
              )}
              <p className="text-[1.2rem] font-light leading-relaxed text-foreground tracking-[-0.01em]">
                {currentPrompt.text}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Input area */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.1, duration: 0.35 } }}
            className="space-y-3"
          >
            <textarea
              value={content}
              onChange={(e) => { setContent(e.target.value); setSavedBrief(false) }}
              placeholder={isListening ? 'Listening…' : 'Write your response…'}
              rows={6}
              aria-label="Your response"
              className="w-full bg-input border border-border rounded-lg px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none transition-all"
            />

            {uploadedFile && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <span className="text-foreground">↑</span> {uploadedFile.name}
                <button onClick={() => setUploadedFile(null)} className="hover:text-destructive transition-colors">×</button>
              </motion.div>
            )}

            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

            <AnimatePresence>
              {savedBrief && (
                <motion.p
                  role="status"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-muted-foreground"
                >
                  Saved.
                </motion.p>
              )}
            </AnimatePresence>

            {/* Actions row */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => doSave(content, uploadedFile?.url)}
                disabled={!content.trim() || isPending}
                className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>

              <button
                onClick={handleDeepen}
                disabled={!content.trim() || loadingFollowUps || isPending}
                className="rounded-md px-4 py-2 text-xs border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 disabled:opacity-40 transition-colors"
              >
                {loadingFollowUps ? (
                  <span className="flex items-center gap-1.5">
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ repeat: Infinity, duration: 1.4 }}
                    >
                      Deepening…
                    </motion.span>
                  </span>
                ) : 'Deepen →'}
              </button>

              {voiceSupported && (
                <button
                  onClick={isListening ? stopListening : startListening}
                  className={`rounded-md px-4 py-2 text-xs border transition-colors ${
                    isListening
                      ? 'border-foreground/30 text-foreground bg-muted'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/20'
                  }`}
                >
                  {isListening ? '⏹ Stop' : '⏺ Voice'}
                </button>
              )}

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-md px-4 py-2 text-xs border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 disabled:opacity-40 transition-colors"
              >
                {uploading ? 'Uploading…' : '↑ Attach'}
              </button>
              <input ref={fileInputRef} type="file" className="hidden"
                accept="image/*,application/pdf,audio/*"
                onChange={handleFileUpload}
              />
            </div>
          </motion.div>

          {/* Follow-up questions — the buttery UX */}
          <AnimatePresence>
            {followUps.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3">
                  <p className="text-label">Go deeper</p>
                  <div className="flex-1 h-px bg-border" />
                  <button
                    onClick={() => setFollowUps([])}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Dismiss all
                  </button>
                </div>

                <Stagger className="space-y-3">
                  {followUps.map((q, i) => (
                    <StaggerItem key={`${i}-${q.text.slice(0, 20)}`}>
                      <FollowUpCard
                        question={q}
                        onSave={(text) => saveFollowUp(i, text)}
                        onDismiss={() => dismissFollowUp(i)}
                        isPending={isPending}
                      />
                    </StaggerItem>
                  ))}
                </Stagger>

                <p className="text-xs text-muted-foreground">
                  Answer what resonates — skip the rest.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.2 } }}
            className="flex items-center gap-4"
          >
            {hasPrev && (
              <button onClick={() => advance('back')}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                ← Previous
              </button>
            )}
            {hasNext && (
              <button onClick={() => advance('forward')}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto">
                Next →
              </button>
            )}
          </motion.div>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="border border-border rounded-lg px-5 py-10 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No prompts available yet for this domain.</p>
          <p className="text-xs text-muted-foreground">
            Complete your{' '}
            <Link href="/onboarding" className="text-foreground underline underline-offset-4">
              profile
            </Link>{' '}
            to receive personalized daily questions.
          </p>
        </motion.div>
      )}

      {/* Saved entries */}
      {entries.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.15 } }}
          className="space-y-4 pt-8 border-t border-border"
        >
          <p className="text-label">{entries.length} saved in {label}</p>
          <Stagger className="space-y-2">
            {entries.map((entry) => (
              <StaggerItem key={entry.id}>
                <div className="border border-border rounded-lg px-4 py-3 space-y-1.5">
                  <p className="text-sm text-foreground leading-relaxed line-clamp-3">{entry.content}</p>
                  {entry.media_url && (
                    <p className="text-xs text-muted-foreground">↑ Attachment</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {entry.sharing_status === 'private' ? 'Private' : 'Shareable'} · {new Date(entry.created_at).toLocaleDateString()}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
          <Link href="/app/review" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Review & tag sharing →
          </Link>
        </motion.div>
      )}
    </div>
  )
}
