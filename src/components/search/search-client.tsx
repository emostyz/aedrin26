'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { EntryCard } from '@/components/review/entry-card'
import type { Database, Domain } from '@/lib/supabase/types'

type SoulEntry = Database['public']['Tables']['soul_entries']['Row']

const DOMAIN_LABELS: Record<Domain, string> = {
  childhood: 'Childhood', family: 'Family', career: 'Career',
  values: 'Values', beliefs: 'Beliefs', lessons: 'Lessons',
  messages: 'Messages', other: 'Other',
}

const DOMAIN_ACCENT: Record<Domain, string> = {
  childhood: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  family:    'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  career:    'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  values:    'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  beliefs:   'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  lessons:   'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  messages:  'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  other:     'bg-muted text-muted-foreground',
}

interface Props {
  entries:   SoulEntry[]
  promptMap: Record<string, string | null>
  domains:   Domain[]
}

/** Return text split into [before, match, after] for the first occurrence of `q` in `text`. */
function splitMatch(text: string, q: string): [string, string, string] | null {
  if (!q) return null
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return null
  return [text.slice(0, idx), text.slice(idx, idx + q.length), text.slice(idx + q.length)]
}

/** Snippet: 120 chars of context centred around the match. */
function snippet(content: string, query: string, maxLen = 160): string {
  if (!query.trim()) return content.slice(0, maxLen)
  const idx = content.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return content.slice(0, maxLen)
  const start = Math.max(0, idx - 60)
  const end   = Math.min(content.length, idx + query.length + 60)
  return (start > 0 ? '…' : '') + content.slice(start, end) + (end < content.length ? '…' : '')
}

function HighlightedSnippet({ text, query }: { text: string; query: string }) {
  const parts = splitMatch(text, query)
  if (!parts) return <span>{text}</span>
  const [before, match, after] = parts
  return (
    <span>
      {before}
      <mark className="bg-foreground/10 text-foreground rounded-sm px-0.5 not-italic">{match}</mark>
      {after}
    </span>
  )
}

export function SearchClient({ entries, promptMap, domains }: Props) {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const inputRef     = useRef<HTMLInputElement>(null)

  const [query, setQuery]             = useState(searchParams.get('q') ?? '')
  const [activeDomain, setActiveDomain] = useState<Domain | 'all'>('all')
  const [expandedId, setExpandedId]   = useState<string | null>(null)

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Sync URL param when query changes (debounced so we don't push on every keystroke)
  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (query.trim()) {
        params.set('q', query.trim())
      } else {
        params.delete('q')
      }
      const qs = params.toString()
      router.replace(qs ? `/app/search?${qs}` : '/app/search', { scroll: false })
    }, 300)
    return () => clearTimeout(timeout)
  }, [query, searchParams, router])

  const filtered = useMemo(() => {
    let result = entries
    if (activeDomain !== 'all') result = result.filter((e) => e.domain === activeDomain)
    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter(
        (e) => e.content.toLowerCase().includes(q) ||
               (promptMap[e.id] ?? '').toLowerCase().includes(q)
      )
    }
    return result
  }, [entries, activeDomain, query, promptMap])

  const hasQuery = query.trim().length > 0

  return (
    <div className="space-y-6">
      {/* Search input */}
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none"
          width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); inputRef.current?.blur() } }}
          placeholder="Search entries, prompts…"
          className="w-full bg-input border border-border rounded-xl pl-11 pr-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <AnimatePresence>
          {hasQuery && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.12 }}
              type="button"
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors p-1"
              aria-label="Clear search"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Domain filter pills */}
      <div className="flex flex-wrap gap-2">
        <FilterPill
          label={`All (${entries.length})`}
          active={activeDomain === 'all'}
          onClick={() => setActiveDomain('all')}
        />
        {domains.map((d) => {
          const count = entries.filter((e) => e.domain === d).length
          return (
            <FilterPill
              key={d}
              label={`${DOMAIN_LABELS[d]} (${count})`}
              active={activeDomain === d}
              onClick={() => setActiveDomain(d)}
            />
          )
        })}
      </div>

      {/* Result count / status */}
      <AnimatePresence mode="wait">
        {hasQuery && (
          <motion.p
            key="count"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="text-xs text-muted-foreground"
          >
            {filtered.length === 0
              ? `No results for "${query}"`
              : `${filtered.length} ${filtered.length === 1 ? 'result' : 'results'} for "${query}"`}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Results */}
      {!hasQuery ? (
        /* Browse mode — flat list, no search active */
        <div className="space-y-2">
          {filtered.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              promptText={promptMap[entry.id] ?? null}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-border rounded-xl px-5 py-12 text-center space-y-2">
          <p className="text-sm text-muted-foreground">Nothing matches that search.</p>
          <p className="text-xs text-muted-foreground/60">
            Try different keywords, or{' '}
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-foreground underline underline-offset-2"
            >
              clear the search
            </button>
            .
          </p>
        </div>
      ) : (
        /* Search results — compact snippet cards */
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {filtered.map((entry) => {
              const isOpen = expandedId === entry.id
              const snip   = snippet(entry.content, query)
              const prompt = promptMap[entry.id]
              return (
                <motion.div
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                >
                  {isOpen ? (
                    /* Full entry card when expanded */
                    <div className="space-y-1">
                      <EntryCard entry={entry} promptText={prompt} />
                      <button
                        type="button"
                        onClick={() => setExpandedId(null)}
                        className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors pl-1"
                      >
                        Collapse ↑
                      </button>
                    </div>
                  ) : (
                    /* Compact snippet card */
                    <button
                      type="button"
                      onClick={() => setExpandedId(entry.id)}
                      className="w-full text-left border border-border hover:border-foreground/15 rounded-xl px-5 py-4 space-y-2 transition-colors duration-150 group"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${DOMAIN_ACCENT[entry.domain as Domain] ?? DOMAIN_ACCENT.other}`}>
                          {DOMAIN_LABELS[entry.domain as Domain] ?? entry.domain}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">
                          {new Date(entry.created_at).toLocaleDateString(undefined, {
                            year: 'numeric', month: 'short', day: 'numeric',
                          })}
                        </span>
                      </div>
                      {prompt && (
                        <p className="text-[11px] text-muted-foreground/60 leading-snug">
                          {prompt}
                        </p>
                      )}
                      <p className="text-sm text-foreground leading-relaxed">
                        <HighlightedSnippet text={snip} query={query} />
                      </p>
                      <p className="text-[10px] text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors">
                        Click to expand →
                      </p>
                    </button>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-3 py-1.5 rounded-full text-xs border transition-all duration-200',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
      ].join(' ')}
    >
      {label}
    </button>
  )
}
