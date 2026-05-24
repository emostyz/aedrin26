'use client'

import { useState, useRef, useTransition, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { saveEntry } from '@/app/actions/entries'
import { suggestFollowUps } from '@/app/actions/ai'
import { motion, AnimatePresence, Stagger, StaggerItem } from '@/components/ui/motion'
import type { Domain, Database } from '@/lib/supabase/types'

type Prompt = Database['public']['Tables']['interview_prompts']['Row']
type Entry  = Database['public']['Tables']['soul_entries']['Row']

interface Props {
  domain: Domain
  label: string
  prompts: Prompt[]
  existingEntries: Entry[]
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

export function InterviewDomain({ domain, label, prompts, existingEntries }: Props) {
  const [promptIndex, setPromptIndex]       = useState(0)
  const [direction, setDirection]           = useState<'forward' | 'back'>('forward')
  const [entries, setEntries]               = useState<Entry[]>(existingEntries)
  const [content, setContent]               = useState('')
  const [error, setError]                   = useState<string | null>(null)
  const [savedBrief, setSavedBrief]         = useState(false)
  const [suggestions, setSuggestions]       = useState<string[]>([])
  const [loadingSugg, setLoadingSugg]       = useState(false)
  const [isListening, setIsListening]       = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [uploadedFile, setUploadedFile]     = useState<{ name: string; url: string } | null>(null)
  const [uploading, setUploading]           = useState(false)
  const [isPending, startTransition]        = useTransition()
  const recognitionRef                      = useRef<SpeechRecognition | null>(null)
  const fileInputRef                        = useRef<HTMLInputElement>(null)
  const textareaRef                         = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    setVoiceSupported(!!SR)
  }, [])

  const currentPrompt = prompts[promptIndex] ?? null
  const hasNext = promptIndex < prompts.length - 1
  const hasPrev = promptIndex > 0

  function advance(dir: 'forward' | 'back') {
    setDirection(dir)
    setPromptIndex((i) => dir === 'forward' ? i + 1 : i - 1)
    setContent('')
    setSuggestions([])
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
      setSuggestions([])
      setUploadedFile(null)
      setSavedBrief(true)
      setTimeout(() => setSavedBrief(false), 2000)
    })
  }

  async function handleSuggest() {
    if (!content.trim()) return
    setLoadingSugg(true)
    setSuggestions([])
    const result = await suggestFollowUps(domain, content.trim())
    setSuggestions(result)
    setLoadingSugg(false)
  }

  return (
    <div className="space-y-16">
      {/* Breadcrumb */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-2 text-xs text-muted-foreground"
      >
        <Link href="/app/interview" className="hover:text-foreground transition-colors">Capture</Link>
        <span>/</span>
        <span className="text-foreground">{label}</span>
      </motion.div>

      {/* Question */}
      {currentPrompt && (
        <div className="space-y-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${promptIndex}-${direction}`}
              initial={{ opacity: 0, x: direction === 'forward' ? 24 : -24 }}
              animate={{ opacity: 1, x: 0, transition: { duration: 0.32, ease: [0.25, 0.1, 0.25, 1] } }}
              exit={{ opacity: 0, x: direction === 'forward' ? -24 : 24, transition: { duration: 0.2 } }}
              className="space-y-3"
            >
              <p className="text-label">{promptIndex + 1} / {prompts.length}</p>
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
              ref={textareaRef}
              value={content}
              onChange={(e) => { setContent(e.target.value); setSavedBrief(false) }}
              placeholder={isListening ? 'Listening…' : 'Write your response…'}
              rows={6}
              aria-label="Your response"
              className="w-full bg-input border border-border rounded-lg px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none transition-all"
            />

            {/* Uploaded file badge */}
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

              <button
                onClick={handleSuggest}
                disabled={!content.trim() || loadingSugg || isPending}
                className="rounded-md px-4 py-2 text-xs border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 disabled:opacity-40 transition-colors"
              >
                {loadingSugg ? 'Thinking…' : 'Follow-ups'}
              </button>
            </div>
          </motion.div>

          {/* AI suggestions */}
          <AnimatePresence>
            {suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <p className="text-label">Suggested follow-ups</p>
                <Stagger className="space-y-2">
                  {suggestions.map((s, i) => (
                    <StaggerItem key={i}>
                      <div className="flex items-start justify-between gap-4 border border-border rounded-lg px-4 py-3">
                        <p className="text-sm text-foreground leading-relaxed flex-1">{s}</p>
                        <button
                          onClick={() => { doSave(s); setSuggestions((p) => p.filter((_, j) => j !== i)) }}
                          disabled={isPending}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 disabled:opacity-40"
                        >
                          Save
                        </button>
                      </div>
                    </StaggerItem>
                  ))}
                </Stagger>
                <p className="text-xs text-muted-foreground">Accept or ignore — never auto-saved.</p>
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
                Skip →
              </button>
            )}
          </motion.div>
        </div>
      )}

      {!currentPrompt && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="border border-border rounded-lg px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">No prompts available for this domain.</p>
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
