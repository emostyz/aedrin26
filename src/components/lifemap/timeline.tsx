'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { createLifeEvent, updateLifeEvent, deleteLifeEvent } from '@/app/actions/life-events'
import { suggestLifeEvents, acceptLifeEvent, type SuggestedLifeEvent, type ExistingLifeEvent } from '@/app/actions/ai'
import type { Database, Domain } from '@/lib/supabase/types'

type LifeEvent = Database['public']['Tables']['life_events']['Row']
type SoulEntry = Pick<
  Database['public']['Tables']['soul_entries']['Row'],
  'id' | 'domain' | 'content' | 'created_at'
>

// ── Domain accent colours ─────────────────────────────────────────────────────
const DOMAIN_ACCENT: Record<Domain, string> = {
  childhood: 'bg-amber-500/20 text-amber-300/80',
  family:    'bg-rose-500/20 text-rose-300/80',
  career:    'bg-blue-500/20 text-blue-300/80',
  values:    'bg-emerald-500/20 text-emerald-300/80',
  beliefs:   'bg-violet-500/20 text-violet-300/80',
  lessons:   'bg-orange-500/20 text-orange-300/80',
  messages:  'bg-teal-500/20 text-teal-300/80',
  other:     'bg-border/40 text-muted-foreground',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function byDate(a: LifeEvent, b: LifeEvent) {
  const ad = a.event_date ?? a.created_at
  const bd = b.event_date ?? b.created_at
  return ad < bd ? -1 : ad > bd ? 1 : 0
}

function toMonthKey(dateStr: string): string {
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, {
    month: 'long', year: 'numeric',
  })
}

function eventMonthKey(event: LifeEvent): string {
  return toMonthKey(event.event_date ?? event.created_at)
}

function buildMonthKeys(events: LifeEvent[], entries: SoulEntry[]): string[] {
  const keys = new Set<string>()
  for (const e of events)  keys.add(eventMonthKey(e))
  for (const e of entries) keys.add(toMonthKey(e.created_at))
  return [...keys].sort()
}

const CURRENT_MONTH = toMonthKey(new Date().toISOString())

// ── Main Timeline component ───────────────────────────────────────────────────

interface Props {
  initialEvents:   LifeEvent[]
  soulEntries?:    SoulEntry[]
  hasSoulEntries?: boolean
}

export function Timeline({ initialEvents, soulEntries = [], hasSoulEntries }: Props) {
  const [events, setEvents]     = useState<LifeEvent[]>(initialEvents)
  const [showForm, setShowForm] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // AI extraction state
  const [extracting, setExtracting]           = useState(false)
  const [suggestions, setSuggestions]         = useState<SuggestedLifeEvent[]>([])
  const [acceptedIndices, setAcceptedIndices] = useState<Set<number>>(new Set())
  const [nothingNewFound, setNothingNewFound] = useState(false)
  const [dismissedExtract, setDismissedExtract] = useState(false)

  // Memory layer toggle
  const [showMemories, setShowMemories] = useState(true)

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleExtract() {
    setExtracting(true)
    setSuggestions([])
    setAcceptedIndices(new Set())
    setNothingNewFound(false)

    // Pass full existing events so the AI can do semantic dedup (title + year + description),
    // not just title-string matching
    const existingForAI: ExistingLifeEvent[] = events.map((e) => ({
      title: e.title,
      year: e.event_date ? parseInt(e.event_date.slice(0, 4), 10) : null,
      description: e.description ?? null,
    }))

    const results = await suggestLifeEvents(existingForAI)

    // Client-side safety net: catch any duplicates the AI missed
    const existingTitles = new Set(events.map((e) => e.title.toLowerCase().trim()))
    const deduped = results.filter((s) => {
      const norm = s.title.toLowerCase().trim()
      if (existingTitles.has(norm)) return false
      for (const ex of existingTitles) {
        if (ex.includes(norm) || norm.includes(ex)) return false
      }
      return true
    })

    if (deduped.length === 0) {
      setNothingNewFound(true)
    } else {
      setSuggestions(deduped)
    }
    setExtracting(false)
  }

  function handleAcceptSuggestion(i: number, ev: SuggestedLifeEvent) {
    startTransition(async () => {
      const result = await acceptLifeEvent(ev)
      if (result?.error) return
      setAcceptedIndices((prev) => new Set([...prev, i]))
      setEvents((prev) => [...prev, {
        id: crypto.randomUUID(), user_id: '',
        title: ev.title,
        event_date: ev.year ? `${ev.year}-01-01` : null,
        description: ev.description ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }].sort(byDate))
    })
  }

  function handleAdd(fd: FormData) {
    setAddError(null)
    startTransition(async () => {
      const result = await createLifeEvent(fd)
      if (result?.error) { setAddError(result.error); return }
      setEvents((prev) => [...prev, {
        id: crypto.randomUUID(), user_id: '',
        title: (fd.get('title') as string).trim(),
        event_date: (fd.get('event_date') as string) || null,
        description: (fd.get('description') as string)?.trim() || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }].sort(byDate))
      setShowForm(false)
    })
  }

  function handleUpdate(id: string, patch: Partial<LifeEvent>) {
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, ...patch } : e).sort(byDate))
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteLifeEvent(id)
      if (!result?.error) setEvents((prev) => prev.filter((e) => e.id !== id))
    })
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const sorted = [...events].sort(byDate)

  const eventsByMonth = new Map<string, LifeEvent[]>()
  for (const ev of sorted) {
    const key = eventMonthKey(ev)
    if (!eventsByMonth.has(key)) eventsByMonth.set(key, [])
    eventsByMonth.get(key)!.push(ev)
  }

  const entriesByMonth = new Map<string, SoulEntry[]>()
  for (const e of soulEntries) {
    const key = toMonthKey(e.created_at)
    if (!entriesByMonth.has(key)) entriesByMonth.set(key, [])
    entriesByMonth.get(key)!.push(e)
  }

  const allMonths = buildMonthKeys(sorted, showMemories ? soulEntries : [])
  const totalItems = sorted.length + (showMemories ? soulEntries.length : 0)

  // Whether to show the extract panel at all:
  // — yes if there are soul entries and we haven't dismissed it permanently
  // — no if the user has dismissed, or if we've confirmed there's nothing new
  const showExtractPanel = hasSoulEntries && !dismissedExtract

  return (
    <div className="space-y-10">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-muted-foreground">
          {sorted.length === 0 && soulEntries.length === 0
            ? ''
            : `${sorted.length} milestone${sorted.length !== 1 ? 's' : ''}${soulEntries.length > 0 ? ` · ${soulEntries.length} memor${soulEntries.length !== 1 ? 'ies' : 'y'}` : ''}`
          }
        </p>
        <div className="flex items-center gap-4">
          {soulEntries.length > 0 && (
            <button
              onClick={() => setShowMemories((v) => !v)}
              className={`text-xs transition-colors ${showMemories ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {showMemories ? 'Hide memories' : 'Show memories'}
            </button>
          )}
          <button
            onClick={() => { setShowForm((v) => !v); setAddError(null) }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showForm ? 'Cancel' : '+ Add milestone'}
          </button>
        </div>
      </div>

      {/* AI extraction panel */}
      {showExtractPanel && (
        <AnimatePresence mode="wait">
          {/* Loading */}
          {extracting && (
            <motion.div
              key="extracting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-4 text-center"
            >
              <motion.p
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.4 }}
                className="text-xs text-muted-foreground"
              >
                Reading your entries…
              </motion.p>
            </motion.div>
          )}

          {/* Nothing new found */}
          {!extracting && nothingNewFound && (
            <motion.div
              key="nothing-new"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="border border-border/40 rounded-lg px-5 py-4 flex items-center justify-between gap-4"
            >
              <p className="text-xs text-muted-foreground">
                Your timeline is up to date — no new milestones found in your recent entries.
              </p>
              <button
                onClick={() => setDismissedExtract(true)}
                className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors shrink-0"
              >
                Dismiss
              </button>
            </motion.div>
          )}

          {/* Suggestions list */}
          {!extracting && suggestions.length > 0 && (
            <motion.div
              key="suggestions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-label">Suggested milestones</p>
                <button
                  onClick={() => { setSuggestions([]); setDismissedExtract(true) }}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Dismiss all
                </button>
              </div>
              <div className="space-y-2">
                {suggestions.map((ev, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`border border-border/60 rounded-lg px-4 py-3 flex items-start gap-3 transition-opacity ${acceptedIndices.has(i) ? 'opacity-40' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-snug">{ev.title}</p>
                      {ev.year && <p className="text-[10px] text-muted-foreground mt-0.5">{ev.year}</p>}
                      {ev.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1">{ev.description}</p>
                      )}
                    </div>
                    {acceptedIndices.has(i) ? (
                      <span className="shrink-0 text-xs text-muted-foreground mt-0.5">Added ✓</span>
                    ) : (
                      <button
                        onClick={() => handleAcceptSuggestion(i, ev)}
                        disabled={isPending}
                        className="shrink-0 text-xs text-muted-foreground border border-border rounded px-2.5 py-1 hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-30 mt-0.5"
                      >
                        + Add
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">Add what&apos;s right. Skip the rest.</p>
            </motion.div>
          )}

          {/* Initial CTA — only shown when no session has run yet */}
          {!extracting && !nothingNewFound && suggestions.length === 0 && (
            <motion.div
              key="extract-cta"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="border border-border/60 rounded-lg px-5 py-4 bg-surface/20 space-y-3"
            >
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your life map fills in automatically from what you&apos;ve shared in Capture — births, moves, jobs, relationships.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExtract}
                  className="text-xs text-foreground border border-border rounded-md px-3 py-1.5 hover:bg-foreground/5 transition-colors"
                >
                  {events.length > 0 ? 'Check for new milestones →' : 'Extract key milestones from my entries →'}
                </button>
                <button
                  onClick={() => setDismissedExtract(true)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Manual add form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <form action={handleAdd} className="border border-border rounded-xl px-5 py-5 space-y-4">
              <p className="text-label">Add a milestone</p>
              <div className="space-y-1.5">
                <label htmlFor="ev-title" className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  What happened *
                </label>
                <input
                  id="ev-title"
                  name="title"
                  required
                  placeholder="e.g. Born in Stockholm"
                  className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="ev-date" className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  When (optional)
                </label>
                <input
                  id="ev-date"
                  name="event_date"
                  type="date"
                  className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="ev-desc" className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  A sentence about it (optional)
                </label>
                <textarea
                  id="ev-desc"
                  name="description"
                  rows={2}
                  placeholder="Why it mattered, what changed…"
                  className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
              {addError && <p role="alert" className="text-xs text-destructive">{addError}</p>}
              <button
                type="submit"
                disabled={isPending}
                className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {isPending ? 'Adding…' : 'Add milestone'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {totalItems === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="py-16 text-center"
        >
          <p className="text-sm text-muted-foreground">
            The moments that shaped you, waiting to be recorded.
          </p>
        </motion.div>
      ) : (
        /* Month-by-month timeline */
        <div className="space-y-0">
          {allMonths.map((monthKey, monthIdx) => {
            const monthEvents  = eventsByMonth.get(monthKey) ?? []
            const monthEntries = showMemories ? (entriesByMonth.get(monthKey) ?? []) : []
            if (monthEvents.length === 0 && monthEntries.length === 0) return null

            const year     = monthKey.slice(0, 4)
            const prevYear = monthIdx > 0 ? allMonths[monthIdx - 1]?.slice(0, 4) : null
            const showYear = year !== prevYear

            return (
              <MonthGroup
                key={monthKey}
                monthLabel={formatMonthLabel(monthKey)}
                year={year}
                showYear={showYear}
                events={monthEvents}
                entries={monthEntries}
                isPending={isPending}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
              />
            )
          })}

          {/* Today terminal marker */}
          <TodayMarker
            shown={!allMonths.includes(CURRENT_MONTH) || (
              (eventsByMonth.get(CURRENT_MONTH) ?? []).length > 0 ||
              (entriesByMonth.get(CURRENT_MONTH) ?? []).length > 0
            )}
          />
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Month group
───────────────────────────────────────────── */

function MonthGroup({
  monthLabel,
  year,
  showYear,
  events,
  entries,
  isPending,
  onDelete,
  onUpdate,
}: {
  monthLabel: string
  year:       string
  showYear:   boolean
  events:     LifeEvent[]
  entries:    SoulEntry[]
  isPending:  boolean
  onDelete:   (id: string) => void
  onUpdate:   (id: string, patch: Partial<LifeEvent>) => void
}) {
  const [entriesExpanded, setEntriesExpanded] = useState(false)
  const visibleEntries = entriesExpanded ? entries : entries.slice(0, 2)
  const hasMore = entries.length > 2 && !entriesExpanded

  return (
    <div className="mb-8">
      {showYear && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3 mb-4 mt-2"
        >
          <span className="text-[11px] font-medium tracking-[0.1em] text-muted-foreground/50 uppercase shrink-0">
            {year}
          </span>
          <div className="flex-1 h-px bg-border/40" />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-3 mb-3"
      >
        <span className="text-label shrink-0">{monthLabel.split(' ')[0]}</span>
        <div className="flex-1 h-px bg-border" />
      </motion.div>

      {events.length > 0 && (
        <div className="space-y-3 pl-4 mb-3">
          {events.map((event, i) => (
            <EventRow
              key={event.id}
              event={event}
              index={i}
              isLast={i === events.length - 1 && entries.length === 0}
              isPending={isPending}
              onDelete={onDelete}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}

      {entries.length > 0 && (
        <div className="pl-4 space-y-1.5">
          {visibleEntries.map((entry) => (
            <MemoryRow key={entry.id} entry={entry} />
          ))}
          {hasMore && (
            <button
              onClick={() => setEntriesExpanded(true)}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors pl-[18px]"
            >
              + {entries.length - 2} more memor{entries.length - 2 === 1 ? 'y' : 'ies'} this month
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Life event row (milestone) — with inline edit
───────────────────────────────────────────── */

function EventRow({
  event,
  index,
  isLast,
  isPending,
  onDelete,
  onUpdate,
}: {
  event:    LifeEvent
  index:    number
  isLast:   boolean
  isPending: boolean
  onDelete: (id: string) => void
  onUpdate: (id: string, patch: Partial<LifeEvent>) => void
}) {
  const [editing, setEditing]       = useState(false)
  const [editError, setEditError]   = useState<string | null>(null)
  const [editPending, startEdit]    = useTransition()

  function handleSave(fd: FormData) {
    setEditError(null)
    startEdit(async () => {
      const result = await updateLifeEvent(event.id, fd)
      if (result?.error) { setEditError(result.error); return }
      onUpdate(event.id, {
        title:       (fd.get('title') as string).trim(),
        event_date:  (fd.get('event_date') as string) || null,
        description: (fd.get('description') as string)?.trim() || null,
      })
      setEditing(false)
    })
  }

  if (editing) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative"
      >
        {/* Dot */}
        <div className="absolute left-0 top-[6px] w-[6px] h-[6px] rounded-full bg-foreground/40 -translate-x-[13px]" />
        <form action={handleSave} className="pl-0 space-y-3 border border-border/60 rounded-lg px-4 py-4 -ml-4">
          <input
            name="title"
            required
            defaultValue={event.title}
            placeholder="What happened"
            className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            name="event_date"
            type="date"
            defaultValue={event.event_date ?? ''}
            className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <textarea
            name="description"
            rows={2}
            defaultValue={event.description ?? ''}
            placeholder="A sentence about why it mattered (optional)"
            className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          {editError && <p className="text-xs text-destructive">{editError}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={editPending}
              className="text-xs text-foreground border border-border rounded-md px-3 py-1.5 hover:bg-foreground/5 transition-colors disabled:opacity-40"
            >
              {editPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setEditError(null) }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="group relative flex items-start gap-3"
    >
      {/* Dot + line */}
      <div className="relative flex flex-col items-center shrink-0 pt-[5px]">
        <div className="w-[6px] h-[6px] rounded-full bg-foreground shrink-0" />
        {!isLast && (
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.3, delay: index * 0.04 + 0.15 }}
            style={{ originY: 0 }}
            className="w-px flex-1 bg-border mt-1.5 min-h-[14px]"
          />
        )}
      </div>

      <div className="flex-1 pb-3 min-w-0">
        <p className="text-sm text-foreground leading-snug">{event.title}</p>
        {event.description && (
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">{event.description}</p>
        )}
      </div>

      {/* Action buttons — revealed on hover */}
      <div className="flex items-center gap-2 shrink-0 pt-[3px] opacity-0 group-hover:opacity-100 transition-all duration-150">
        <button
          onClick={() => setEditing(true)}
          aria-label={`Edit "${event.title}"`}
          className="text-muted-foreground hover:text-foreground transition-colors text-[10px] leading-none"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(event.id)}
          disabled={isPending}
          aria-label={`Remove "${event.title}"`}
          className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30 text-xs leading-none"
        >
          ×
        </button>
      </div>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────
   Memory snippet row (soul entry)
───────────────────────────────────────────── */

function MemoryRow({ entry }: { entry: SoulEntry }) {
  const [expanded, setExpanded] = useState(false)
  const isLong   = entry.content.length > 160
  const snippet  = isLong && !expanded
    ? entry.content.slice(0, 160).trimEnd() + '…'
    : entry.content

  const domainClass = DOMAIN_ACCENT[entry.domain as Domain] ?? DOMAIN_ACCENT.other

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-start gap-2.5 pl-[18px]"
    >
      <div className="shrink-0 w-[5px] h-[5px] rounded-full border border-border bg-transparent mt-[5px]" />
      <div className="flex-1 min-w-0 pb-1.5">
        <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm font-medium ${domainClass}`}>
          {entry.domain}
        </span>
        <p className="text-[12px] text-muted-foreground leading-relaxed mt-1">
          {snippet}
          {isLong && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="ml-1 text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              more
            </button>
          )}
        </p>
      </div>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────
   Today terminal marker
───────────────────────────────────────────── */

function TodayMarker({ shown }: { shown: boolean }) {
  if (!shown) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="flex items-center gap-3 mt-6"
    >
      <span className="text-label shrink-0">Today</span>
      <div className="flex-1 h-px bg-border" />
    </motion.div>
  )
}
