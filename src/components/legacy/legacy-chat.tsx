'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from '@/components/ui/motion'
import type { Domain } from '@/lib/supabase/types'

type Message = { role: 'user' | 'assistant'; content: string; entryCount?: number }

interface Props {
  deceasedUserId: string
  deceasedName: string
  heirId: string
  heirName: string
  allowedDomains?: Domain[]
  expiresAt?: string | null
  canNegotiate?: boolean
}

// Typing indicator — three dots in a graceful rhythm
function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25 }}
      className="flex justify-start"
    >
      <div className="border border-border/60 bg-surface/50 rounded-2xl rounded-bl-sm px-5 py-3.5">
        <div className="flex gap-1.5 items-center h-3">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1 h-1 rounded-full bg-muted-foreground/50"
              animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export function LegacyChat({ deceasedUserId, deceasedName, heirId, heirName, allowedDomains, expiresAt, canNegotiate }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const bottomRef               = useRef<HTMLDivElement>(null)
  const inputRef                = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(e?: React.FormEvent) {
    e?.preventDefault()
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setError(null)
    setMessages((prev) => [...prev, { role: 'user', content: q }])
    setLoading(true)

    try {
      const res = await fetch('/api/legacy/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deceasedUserId, heirId, question: q }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return }
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: data.answer,
        entryCount: data.entryIds?.length ?? 0,
      }])
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  // Send on Enter (without shift)
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const initials = deceasedName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col min-h-[calc(100dvh-3.5rem)] max-w-2xl mx-auto w-full">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
        className="shrink-0 pt-10 pb-8 px-6 space-y-4 border-b border-border"
      >
        {/* Avatar + name */}
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-surface border border-border flex items-center justify-center shrink-0">
            <span className="text-sm font-light text-muted-foreground tracking-wider">{initials}</span>
          </div>
          <div>
            <p className="text-label">Legacy</p>
            <p className="text-[1.2rem] font-light tracking-[-0.02em] text-foreground leading-snug">
              {deceasedName}
            </p>
          </div>
        </div>

        {/* Grounding disclaimer */}
        <p className="text-xs text-muted-foreground/70 leading-relaxed max-w-sm">
          Answers are drawn only from what {deceasedName.split(' ')[0]} recorded.
          Accessed by <span className="text-muted-foreground">{heirName}</span>.
        </p>

        {/* Scope, expiry & negotiation — transparency as a security feature */}
        <div className="space-y-1.5">
          {allowedDomains && allowedDomains.length > 0 && (
            <p className="text-[10px] text-muted-foreground/60">
              In scope: {allowedDomains.join(' · ')}
            </p>
          )}
          {expiresAt && (
            <p className="text-[10px] text-muted-foreground/60">
              Access expires {new Date(expiresAt).toLocaleDateString()}
            </p>
          )}
          {canNegotiate && (
            <Link
              href={`/app/legacy/${deceasedUserId}/negotiations`}
              className="inline-block text-[11px] text-foreground underline underline-offset-2 hover:opacity-70 transition-opacity"
            >
              Open negotiations →
            </Link>
          )}
        </div>
      </motion.div>

      {/* ── Messages ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-5 min-h-0">

        {/* Empty prompt */}
        {messages.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.45 }}
            className="flex flex-col items-center justify-center gap-4 py-16 text-center"
          >
            <div className="w-14 h-14 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground/40">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm text-foreground font-light">
                Ask something you always wanted to know.
              </p>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                Take as long as you need. There&apos;s no wrong question.
              </p>
            </div>

            {/* Suggested questions */}
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {[
                `What did ${deceasedName.split(' ')[0]} find most meaningful?`,
                'What would they want me to remember?',
                'What were they most proud of?',
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50) }}
                  className="text-xs text-muted-foreground border border-border rounded-full px-3.5 py-1.5 hover:border-foreground/20 hover:text-foreground transition-all duration-200"
                >
                  {q}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Message list */}
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-5 h-5 rounded-full bg-surface border border-border/60 flex items-center justify-center text-[8px] text-muted-foreground shrink-0 mr-2.5 mt-1">
                  {initials[0]}
                </div>
              )}

              <div className={`max-w-[82%] space-y-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-foreground text-background rounded-br-sm'
                    : 'border border-border/60 bg-surface/50 text-foreground rounded-bl-sm'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap font-light">{msg.content}</p>
                </div>

                {msg.role === 'assistant' && msg.entryCount !== undefined && msg.entryCount > 0 && (
                  <p className="text-[10px] text-muted-foreground/50 px-1">
                    {msg.entryCount} {msg.entryCount === 1 ? 'memory' : 'memories'} referenced
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        <AnimatePresence>
          {loading && <TypingIndicator key="typing" />}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="text-xs text-destructive text-center py-2"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* ── Input ───────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="shrink-0 border-t border-border px-6 py-5 space-y-4"
      >
        <form onSubmit={send} className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Ask something…"
            rows={1}
            aria-label="Your message"
            className="flex-1 bg-input border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all disabled:opacity-50 resize-none leading-relaxed"
            style={{ minHeight: '44px', maxHeight: '120px', overflowY: 'auto' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="shrink-0 bg-primary text-primary-foreground rounded-xl px-4 py-3 text-xs font-medium hover:opacity-90 disabled:opacity-30 transition-opacity h-[44px] flex items-center"
          >
            Send
          </button>
        </form>

        {/* Grief support — subtle and accessible */}
        <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
          Grief support:{' '}
          <a href="https://www.griefshare.org" target="_blank" rel="noopener noreferrer"
            className="hover:text-muted-foreground transition-colors underline underline-offset-2">GriefShare</a>
          {' · '}
          <a href="https://www.hospicefoundation.org" target="_blank" rel="noopener noreferrer"
            className="hover:text-muted-foreground transition-colors underline underline-offset-2">Hospice Foundation</a>
          {' · '}
          <a href="https://www.modernloss.com" target="_blank" rel="noopener noreferrer"
            className="hover:text-muted-foreground transition-colors underline underline-offset-2">Modern Loss</a>
        </p>
      </motion.div>
    </div>
  )
}
