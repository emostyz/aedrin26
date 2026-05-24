'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'

type Message = { role: 'user' | 'assistant'; content: string; entryCount?: number }

interface Props {
  deceasedUserId: string
  deceasedName: string
  heirId: string
  heirName: string
}

export function LegacyChat({ deceasedUserId, deceasedName, heirId, heirName }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const bottomRef               = useRef<HTMLDivElement>(null)
  const inputRef                = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(e: React.FormEvent) {
    e.preventDefault()
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
      inputRef.current?.focus()
    }
  }

  return (
    <div className="flex flex-col flex-1 max-w-2xl mx-auto w-full px-6 py-8 gap-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-0.5">
        <p className="text-label">Legacy</p>
        <p className="text-[1.4rem] font-light tracking-[-0.02em] text-foreground">{deceasedName}</p>
        <p className="text-xs text-muted-foreground">Accessed by {heirName}</p>
      </motion.div>

      {/* Messages */}
      <div className="flex-1 space-y-6 min-h-0">
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.15 } }}
            className="border border-border rounded-lg px-5 py-8 text-center"
          >
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ask something you always wanted to know.<br />
              Answers come only from what {deceasedName} recorded.
            </p>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.28 } }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] rounded-lg px-4 py-3 space-y-2 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-surface text-foreground'
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                {msg.role === 'assistant' && msg.entryCount !== undefined && msg.entryCount > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {msg.entryCount} recorded {msg.entryCount === 1 ? 'entry' : 'entries'} referenced
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="border border-border bg-surface rounded-lg px-4 py-3">
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1 h-1 rounded-full bg-muted-foreground"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            role="alert" className="text-xs text-destructive text-center">
            {error}
          </motion.p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}
        onSubmit={send}
        className="flex gap-3 border-t border-border pt-6"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          placeholder="Ask something…"
          aria-label="Your message"
          className="flex-1 bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-xs font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
        >
          Send
        </button>
      </motion.form>

      {/* §4.5 Psychological care resources */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.4 } }}
        className="border-t border-border pt-4 space-y-1"
      >
        <p className="text-[10px] text-muted-foreground">
          Grief support:{' '}
          <a href="https://www.griefshare.org" target="_blank" rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors">GriefShare</a>
          {' · '}
          <a href="https://www.hospicefoundation.org" target="_blank" rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors">Hospice Foundation</a>
          {' · '}
          <a href="https://www.modernloss.com" target="_blank" rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors">Modern Loss</a>
        </p>
      </motion.div>
    </div>
  )
}
