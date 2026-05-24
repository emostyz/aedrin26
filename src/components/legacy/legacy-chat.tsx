'use client'

import { useState, useRef, useEffect } from 'react'

type Message = {
  role: 'user' | 'assistant'
  content: string
  entryIds?: string[]
}

interface Props {
  deceasedUserId: string
  deceasedName: string
  heirId: string
  heirName: string
}

export function LegacyChat({ deceasedUserId, deceasedName, heirId, heirName }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const question = input.trim()
    setInput('')
    setError(null)
    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setIsLoading(true)

    try {
      const res = await fetch('/api/legacy/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deceasedUserId, heirId, question }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error ?? 'Something went wrong.')
        return
      }

      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: data.answer,
        entryIds: data.entryIds,
      }])
    } catch {
      setError('Failed to reach the server. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-6rem)]">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 flex flex-col flex-1 gap-6">

        <div>
          <h2 className="text-xl font-semibold text-foreground">{deceasedName}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Accessible to {heirName} · Responses draw only from recorded material
          </p>
        </div>

        {/* Conversation */}
        <div className="flex-1 space-y-5">
          {messages.length === 0 && (
            <div className="rounded-lg border border-border px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Ask something you wish you could have talked about.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={[
                'max-w-[80%] rounded-lg px-4 py-3',
                msg.role === 'user'
                  ? 'bg-foreground text-background text-sm'
                  : 'border border-border bg-background text-sm text-foreground',
              ].join(' ')}>
                <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                {msg.role === 'assistant' && msg.entryIds && msg.entryIds.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Based on {msg.entryIds.length} recorded {msg.entryIds.length === 1 ? 'entry' : 'entries'}
                  </p>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="border border-border bg-background rounded-lg px-4 py-3">
                <p className="text-sm text-muted-foreground">…</p>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive text-center">{error}</p>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="flex gap-3 pt-2 border-t border-border">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder="Ask something…"
            aria-label="Your message"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
