'use client'

import { useState, useRef, useTransition } from 'react'
import Link from 'next/link'
import { saveEntry } from '@/app/actions/entries'
import { suggestFollowUps } from '@/app/actions/ai'
import type { Domain } from '@/lib/supabase/types'
import type { Database } from '@/lib/supabase/types'

type Prompt = Database['public']['Tables']['interview_prompts']['Row']
type Entry = Database['public']['Tables']['soul_entries']['Row']

interface Props {
  domain: Domain
  label: string
  prompts: Prompt[]
  existingEntries: Entry[]
}

export function InterviewDomain({ domain, label, prompts, existingEntries }: Props) {
  const [promptIndex, setPromptIndex] = useState(0)
  const [entries, setEntries] = useState<Entry[]>(existingEntries)
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const currentPrompt = prompts[promptIndex] ?? null
  const hasMore = promptIndex < prompts.length - 1

  function handleSkip() {
    if (hasMore) {
      setPromptIndex((i) => i + 1)
      setContent('')
      setSuggestions([])
      setSaved(false)
      setError(null)
    }
  }

  function handleSave() {
    if (!content.trim()) return
    setError(null)

    const fd = new FormData()
    fd.set('domain', domain)
    fd.set('content', content.trim())
    if (currentPrompt) fd.set('prompt_id', currentPrompt.id)

    startTransition(async () => {
      const result = await saveEntry(fd)
      if (result?.error) {
        setError(result.error)
        return
      }
      setSaved(true)
      // Optimistically prepend the new entry to the list
      setEntries((prev) => [
        {
          id: crypto.randomUUID(),
          user_id: '',
          domain,
          prompt_id: currentPrompt?.id ?? null,
          content: content.trim(),
          media_url: null,
          sharing_status: 'private',
          bound_recipient_id: null,
          source: 'typed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ...prev,
      ])
      setContent('')
      setSuggestions([])
      setTimeout(() => setSaved(false), 2000)
    })
  }

  async function handleSuggest() {
    if (!content.trim()) return
    setLoadingSuggestions(true)
    setSuggestions([])
    const result = await suggestFollowUps(domain, content.trim())
    setSuggestions(result)
    setLoadingSuggestions(false)
  }

  function applySuggestion(suggestion: string) {
    const fd = new FormData()
    fd.set('domain', domain)
    fd.set('content', suggestion)
    if (currentPrompt) fd.set('prompt_id', currentPrompt.id)

    startTransition(async () => {
      const result = await saveEntry(fd)
      if (result?.error) {
        setError(result.error)
        return
      }
      setSuggestions((prev) => prev.filter((s) => s !== suggestion))
    })
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-3">
        <Link href="/app/interview" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Capture
        </Link>
        <span className="text-muted-foreground">/</span>
        <h2 className="text-sm font-medium text-foreground">{label}</h2>
      </div>

      {/* Current prompt */}
      {currentPrompt ? (
        <div className="space-y-5">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">
              {promptIndex + 1} of {prompts.length}
            </p>
            <p className="text-base text-foreground leading-relaxed">
              {currentPrompt.text}
            </p>
          </div>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              setSaved(false)
            }}
            placeholder="Write your response…"
            rows={6}
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            aria-label="Your response"
          />

          {error && (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          )}

          {saved && (
            <p role="status" className="text-sm text-muted-foreground">Saved.</p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSave}
              disabled={!content.trim() || isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={handleSuggest}
              disabled={!content.trim() || loadingSuggestions || isPending}
              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-40 transition-colors"
            >
              {loadingSuggestions ? 'Thinking…' : 'Suggest follow-ups'}
            </button>
            {hasMore && (
              <button
                onClick={handleSkip}
                className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip →
              </button>
            )}
          </div>

          {/* AI follow-up suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Suggested follow-ups</p>
              <ul className="space-y-2">
                {suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-foreground border border-border rounded-lg px-4 py-3">
                    <span className="flex-1 leading-relaxed">{s}</span>
                    <button
                      onClick={() => applySuggestion(s)}
                      disabled={isPending}
                      className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-40"
                    >
                      Save this
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">These are suggestions — accept or ignore any of them.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">No prompts available for this domain yet.</p>
        </div>
      )}

      {/* Saved entries for this domain */}
      {entries.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'} in {label}
          </p>
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-border px-4 py-3">
                <p className="text-sm text-foreground leading-relaxed line-clamp-3">{entry.content}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {entry.sharing_status === 'private' ? 'Private' : 'Shareable'} ·{' '}
                  {new Date(entry.created_at).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
          <Link href="/app/review" className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground">
            Review and tag sharing status →
          </Link>
        </div>
      )}
    </div>
  )
}
