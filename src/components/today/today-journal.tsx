'use client'

import { useState, useTransition, useRef } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { saveEntry } from '@/app/actions/entries'
import { SoundwaveRecorder } from '@/components/ui/soundwave-recorder'
import type { Domain } from '@/lib/supabase/types'

interface JournalEntry {
  id: string
  content: string
  domain: string
  created_at: string
}

interface Props {
  todayEntries: JournalEntry[]
  recentEntries: JournalEntry[]       // last ~7 days, excludes today
  todayPromptText: string | null
}

// Optional domain tagging (collapsed by default)
const QUICK_DOMAINS: { value: Domain; label: string; dot: string }[] = [
  { value: 'other',     label: 'Journal',   dot: 'bg-muted-foreground' },
  { value: 'childhood', label: 'Childhood', dot: 'bg-amber-400' },
  { value: 'family',    label: 'Family',    dot: 'bg-rose-400' },
  { value: 'career',    label: 'Career',    dot: 'bg-blue-400' },
  { value: 'values',    label: 'Values',    dot: 'bg-emerald-400' },
  { value: 'beliefs',   label: 'Beliefs',   dot: 'bg-violet-400' },
  { value: 'lessons',   label: 'Lessons',   dot: 'bg-orange-400' },
  { value: 'messages',  label: 'Messages',  dot: 'bg-teal-400' },
]

const DOMAIN_LABEL: Record<string, string> = {
  childhood: 'Childhood',
  family: 'Family',
  career: 'Career',
  values: 'Values',
  beliefs: 'Beliefs',
  lessons: 'Lessons',
  messages: 'Messages',
  other: 'Journal',
}

function ago(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  const hrs  = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hrs < 24) return `${hrs}h ago`
  return `${days}d ago`
}

function dayLabel(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  // Use local date comparison
  const isoDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const todayDay = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayDay = yesterday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (isoDay === todayDay) return 'Today'
  if (isoDay === yesterdayDay) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

// Group entries by calendar day
function groupByDay(entries: JournalEntry[]): Array<{ label: string; entries: JournalEntry[] }> {
  const map = new Map<string, JournalEntry[]>()
  for (const e of entries) {
    const key = e.created_at.slice(0, 10)
    const arr = map.get(key) ?? []
    arr.push(e)
    map.set(key, arr)
  }
  // Sort days descending
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, list]) => ({ label: dayLabel(`${key}T12:00:00Z`), entries: list }))
}

export function TodayJournal({ todayEntries, recentEntries, todayPromptText }: Props) {
  const [content, setContent]         = useState('')
  const [domain, setDomain]           = useState<Domain>('other')
  const [showDomains, setShowDomains] = useState(false)
  const [showExtra, setShowExtra]     = useState(false)
  const [savedCount, setSavedCount]   = useState(0)
  const [error, setError]             = useState<string | null>(null)
  const [savedBrief, setSavedBrief]   = useState(false)
  const [isPending, startTransition]  = useTransition()
  const textareaRef                   = useRef<HTMLTextAreaElement>(null)

  // Live list of today's entries (starts from server fetch, extends as we save)
  const [liveToday, setLiveToday] = useState<JournalEntry[]>(todayEntries)

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length
  const activeDomainMeta = QUICK_DOMAINS.find((d) => d.value === domain) ?? QUICK_DOMAINS[0]

  function handleSave() {
    const text = content.trim()
    if (!text || isPending) return
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('domain', domain)
      fd.set('content', text)
      const result = await saveEntry(fd)
      if (result?.error) { setError(result.error); return }
      // Optimistically prepend to today's list
      const newEntry: JournalEntry = {
        id: crypto.randomUUID(),
        content: text,
        domain,
        created_at: new Date().toISOString(),
      }
      setLiveToday((prev) => [newEntry, ...prev])
      setSavedCount((n) => n + 1)
      setContent('')
      setSavedBrief(true)
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
      setTimeout(() => setSavedBrief(false), 2000)
    })
  }

  const allPast = [...recentEntries]
  const days = groupByDay(allPast)

  return (
    <div className="space-y-10">
      {/* Write area */}
      <div className="space-y-4">
        {/* Optional: show today's reflection prompt as a writing spark */}
        {todayPromptText && (
          <div className="border border-border/40 rounded-xl px-5 py-4 space-y-1.5 bg-surface/20">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Today&apos;s prompt</p>
            <p className="text-sm text-foreground/70 font-light leading-relaxed">{todayPromptText}</p>
            <p className="text-[10px] text-muted-foreground/50">
              You can answer this here, or just write freely below.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${e.target.scrollHeight}px`
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSave() }
            }}
            placeholder="What happened today? What are you thinking about? Write anything…"
            rows={5}
            style={{ minHeight: '140px' }}
            className="w-full bg-input border border-border rounded-xl px-5 py-4 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed transition-all"
          />

          {/* Recorder + word count row */}
          <div className="flex items-center justify-between gap-3">
            <SoundwaveRecorder onTranscript={(t) => setContent(t)} canvasHeight={36} />
            {wordCount > 0 && (
              <span className="text-[10px] text-muted-foreground/50 shrink-0">
                {wordCount} words{content.trim() && <span className="text-muted-foreground/30 ml-2">⌘↵ save</span>}
              </span>
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          {/* Optional domain tag */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowDomains((v) => !v)}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${activeDomainMeta.dot}`} />
              {activeDomainMeta.label}
              <span className="opacity-50">{showDomains ? '▲' : '▼'}</span>
            </button>
            <AnimatePresence>
              {showDomains && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-wrap gap-1.5 overflow-hidden"
                >
                  {QUICK_DOMAINS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => { setDomain(d.value); setShowDomains(false) }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border transition-all ${
                        domain === d.value
                          ? 'border-foreground/30 bg-foreground/5 text-foreground'
                          : 'border-border text-muted-foreground hover:border-foreground/20'
                      }`}
                    >
                      <span className={`w-1 h-1 rounded-full ${d.dot}`} />
                      {d.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={!content.trim() || isPending}
              className="bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
            <AnimatePresence>
              {savedBrief && (
                <motion.p
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-muted-foreground"
                >
                  Saved ✓
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Today's entries */}
      {liveToday.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <p className="text-label shrink-0">Today</p>
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground/50 shrink-0">
              {liveToday.length} {liveToday.length === 1 ? 'entry' : 'entries'}
              {savedCount > 0 && <span className="ml-1 text-muted-foreground/30">· {savedCount} this session</span>}
            </span>
          </div>
          <div className="space-y-2">
            {liveToday.map((e) => (
              <EntryBlock key={e.id} entry={e} />
            ))}
          </div>
        </div>
      )}

      {/* Past days */}
      {days.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <p className="text-label shrink-0">Recent</p>
            <div className="flex-1 h-px bg-border" />
            {days.length > 3 && (
              <button
                type="button"
                onClick={() => setShowExtra((v) => !v)}
                className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0"
              >
                {showExtra ? 'Show less' : `Show all ${days.length} days`}
              </button>
            )}
          </div>

          {(showExtra ? days : days.slice(0, 3)).map(({ label, entries }) => (
            <div key={label} className="space-y-2">
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">{label}</p>
              {entries.map((e) => (
                <EntryBlock key={e.id} entry={e} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Empty past state */}
      {liveToday.length === 0 && days.length === 0 && (
        <div className="border border-dashed border-border rounded-xl px-6 py-12 text-center space-y-2">
          <p className="text-sm text-muted-foreground">Your journal is empty — the first entry starts here.</p>
        </div>
      )}
    </div>
  )
}

function EntryBlock({ entry }: { entry: JournalEntry }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = entry.content.length > 300
  const display = (!expanded && isLong) ? entry.content.slice(0, 300).trimEnd() + '…' : entry.content

  return (
    <div className="border border-border/50 rounded-xl px-5 py-4 space-y-2 hover:border-border transition-colors">
      <p className="text-sm text-foreground/80 font-light leading-relaxed whitespace-pre-wrap">{display}</p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
      <div className="flex items-center gap-3 pt-0.5">
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground/40">
          {DOMAIN_LABEL[entry.domain] ?? entry.domain}
        </span>
        <span className="text-muted-foreground/20 text-[9px]">·</span>
        <span className="text-[9px] text-muted-foreground/40">
          {new Date(entry.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </span>
        <span className="text-muted-foreground/20 text-[9px]">·</span>
        <span className="text-[9px] text-muted-foreground/30">{ago(entry.created_at)}</span>
      </div>
    </div>
  )
}
