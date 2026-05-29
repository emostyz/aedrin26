'use client'

import { useState, useRef, useEffect, useTransition, useCallback } from 'react'
import Link from 'next/link'
import { getMemoirChatResponse, saveConversationAsEntries } from '@/app/actions/memoir-chat'
import type { Domain } from '@/lib/supabase/types'

const DOMAIN_LABELS: Record<Domain, string> = {
  childhood: 'childhood',
  family: 'family',
  career: 'career',
  values: 'values',
  beliefs: 'beliefs',
  lessons: 'lessons',
  messages: 'messages',
  other: 'life',
}

type ChatMessage = { role: 'user' | 'assistant'; content: string }

interface Props {
  domain: Domain
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

export function MemoirChat({ domain }: Props) {
  const domainLabel = DOMAIN_LABELS[domain]

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `I'd love to hear about your ${domainLabel}. What's the first memory that comes to mind when you think about it?`,
    },
  ])
  const [input, setInput] = useState('')
  const [isPending, startTransition] = useTransition()
  const [isSaving, startSaving] = useTransition()
  // Total entries persisted in this session — drives the running banner and
  // tells the server how many to skip so we never duplicate a turn.
  const [savedSoFar, setSavedSoFar] = useState(0)
  // Most-recent batch result, shown briefly so the user gets feedback.
  const [lastBatch, setLastBatch] = useState<{ saved: number; failed: number } | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isPending])

  const userMessageCount = messages.filter((m) => m.role === 'user').length

  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || isPending) return

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: trimmed },
    ]
    setMessages(newMessages)
    setInput('')

    startTransition(async () => {
      try {
        const { reply } = await getMemoirChatResponse(newMessages, domain)
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: "I'm sorry, something went wrong. Please try again." },
        ])
      }
    })
  }, [input, isPending, messages, domain])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  // Count of eligible (substantive) user turns in the current thread —
  // mirrors the server's filter so the visible "ready to save" affordance
  // matches what would actually be persisted.
  const eligibleCount = messages.filter(
    (m) => m.role === 'user' && m.content.trim().length >= 20,
  ).length

  // Anything new since the last save is what the next press will write.
  const pendingToSave = Math.max(0, eligibleCount - savedSoFar)

  function handleSaveToJournal() {
    setSaveError(null)
    startSaving(async () => {
      const result = await saveConversationAsEntries(messages, domain, savedSoFar)
      if (result.error) {
        setSaveError(result.error)
        return
      }
      setSavedSoFar((prev) => prev + result.saved)
      setLastBatch({ saved: result.saved, failed: result.failed })
    })
  }

  return (
    <div className="space-y-4">
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="max-h-[60vh] overflow-y-auto space-y-3 pr-1"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] text-sm leading-relaxed font-light ${
                msg.role === 'assistant'
                  ? 'bg-surface/30 border border-border/40 rounded-2xl rounded-tl-sm px-4 py-3 text-foreground/90'
                  : 'bg-foreground/5 border border-border/40 rounded-2xl rounded-tr-sm px-4 py-3 text-foreground'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isPending && (
          <div className="flex justify-start">
            <div className="bg-surface/30 border border-border/40 rounded-2xl rounded-tl-sm">
              <TypingIndicator />
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="space-y-3 pt-2 border-t border-border/40">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your response…"
            rows={3}
            disabled={isPending}
            className="w-full bg-input border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none transition-all disabled:opacity-50"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={handleSend}
            disabled={!input.trim() || isPending}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
          >
            Send <span className="text-primary-foreground/60 ml-1">⌘↵</span>
          </button>

          {/* Save button stays available as long as there's new material since
              the last save — replaces the old one-shot `saved` flag that
              permanently hid the button after the first batch. */}
          {userMessageCount >= 3 && pendingToSave > 0 && (
            <button
              onClick={handleSaveToJournal}
              disabled={isSaving}
              className="text-xs border border-border rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground hover:border-foreground/20 disabled:opacity-40 transition-colors"
            >
              {isSaving
                ? 'Saving…'
                : savedSoFar > 0
                  ? `Save ${pendingToSave} more`
                  : 'Save to journal'}
            </button>
          )}
        </div>

        {saveError && (
          <p className="text-xs text-destructive">{saveError}</p>
        )}

        {savedSoFar > 0 && (
          <div className="flex items-center justify-between text-xs">
            <p className="text-muted-foreground">
              {savedSoFar} {savedSoFar === 1 ? 'entry' : 'entries'} saved
              {lastBatch && lastBatch.failed > 0 && (
                <span className="text-destructive ml-1">
                  · {lastBatch.failed} couldn&apos;t be saved
                </span>
              )}
            </p>
            <Link
              href={`/app/interview/${domain}`}
              className="text-foreground hover:underline underline-offset-2"
            >
              View your entries →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
