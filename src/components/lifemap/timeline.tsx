'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { createLifeEvent, deleteLifeEvent } from '@/app/actions/life-events'
import type { Database } from '@/lib/supabase/types'

type LifeEvent = Database['public']['Tables']['life_events']['Row']

function byDate(a: LifeEvent, b: LifeEvent) {
  const ad = a.event_date ?? a.created_at
  const bd = b.event_date ?? b.created_at
  return ad < bd ? -1 : ad > bd ? 1 : 0
}

function getYear(event: LifeEvent): number {
  const raw = event.event_date ?? event.created_at
  return new Date(raw.includes('T') ? raw : raw + 'T00:00:00').getFullYear()
}

function formatMonthYear(event: LifeEvent): string {
  const raw = event.event_date ?? event.created_at
  const d = new Date(raw.includes('T') ? raw : raw + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function groupByYear(events: LifeEvent[]): [number, LifeEvent[]][] {
  const map = new Map<number, LifeEvent[]>()
  for (const ev of events) {
    const y = getYear(ev)
    if (!map.has(y)) map.set(y, [])
    map.get(y)!.push(ev)
  }
  return Array.from(map.entries()).sort(([a], [b]) => a - b)
}

const CURRENT_YEAR = new Date().getFullYear()

export function Timeline({ initialEvents }: { initialEvents: LifeEvent[] }) {
  const [events, setEvents]     = useState<LifeEvent[]>(initialEvents)
  const [showForm, setShowForm] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdd(fd: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await createLifeEvent(fd)
      if (result?.error) { setError(result.error); return }
      setEvents((prev) => [...prev, {
        id: crypto.randomUUID(), user_id: '',
        title: fd.get('title') as string,
        event_date: fd.get('event_date') as string | null || null,
        description: fd.get('description') as string | null || null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }].sort(byDate))
      setShowForm(false)
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteLifeEvent(id)
      if (!result?.error) setEvents((prev) => prev.filter((e) => e.id !== id))
    })
  }

  const sorted  = [...events].sort(byDate)
  const groups  = groupByYear(sorted)

  // Compute a flat index offset per group for stagger delay
  let eventIndex = 0

  return (
    <div className="space-y-10">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {events.length === 0 ? '' : `${events.length} event${events.length === 1 ? '' : 's'}`}
        </p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {/* Add form — animated expand/collapse */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <form action={handleAdd} className="border border-border rounded-lg px-5 py-5 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="ev-title" className="text-label">Title *</label>
                <input
                  id="ev-title"
                  name="title"
                  required
                  placeholder="e.g. Born in Stockholm"
                  className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="ev-date" className="text-label">
                  Date{' '}
                  <span className="normal-case font-normal text-muted-foreground">(optional)</span>
                </label>
                <input
                  id="ev-date"
                  name="event_date"
                  type="date"
                  className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="ev-desc" className="text-label">
                  Description{' '}
                  <span className="normal-case font-normal text-muted-foreground">(optional)</span>
                </label>
                <textarea
                  id="ev-desc"
                  name="description"
                  rows={3}
                  className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
              {error && (
                <p role="alert" className="text-xs text-destructive">{error}</p>
              )}
              <button
                type="submit"
                disabled={isPending}
                className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {isPending ? 'Adding…' : 'Add event'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {sorted.length === 0 ? (
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
        <div className="space-y-0">
          {groups.map(([year, yearEvents]) => {
            const groupStartIndex = eventIndex
            eventIndex += yearEvents.length
            return (
              <YearGroup
                key={year}
                year={year}
                events={yearEvents}
                startIndex={groupStartIndex}
                isPending={isPending}
                onDelete={handleDelete}
              />
            )
          })}

          {/* Today terminal marker */}
          <TodayMarker
            eventIndex={eventIndex}
            hasCurrentYear={groups.some(([y]) => y === CURRENT_YEAR)}
          />
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Year group
───────────────────────────────────────────── */

function YearGroup({
  year,
  events,
  startIndex,
  isPending,
  onDelete,
}: {
  year: number
  events: LifeEvent[]
  startIndex: number
  isPending: boolean
  onDelete: (id: string) => void
}) {
  return (
    <div className="mb-6">
      {/* Year divider */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: startIndex * 0.04, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex items-center gap-3 mb-3"
      >
        <span className="text-label shrink-0">{year}</span>
        <div className="flex-1 h-px bg-border" />
      </motion.div>

      {/* Events in this year */}
      <div className="space-y-3 pl-4">
        {events.map((event, i) => (
          <EventRow
            key={event.id}
            event={event}
            index={startIndex + i}
            isLast={i === events.length - 1}
            isPending={isPending}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Single event row
───────────────────────────────────────────── */

function EventRow({
  event,
  index,
  isLast,
  isPending,
  onDelete,
}: {
  event: LifeEvent
  index: number
  isLast: boolean
  isPending: boolean
  onDelete: (id: string) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: [0.25, 0.1, 0.25, 1] }}
      className="group relative flex items-start gap-3"
    >
      {/* Dot + connecting line column */}
      <div className="relative flex flex-col items-center shrink-0 pt-[5px]">
        {/* Filled dot */}
        <div className="w-[6px] h-[6px] rounded-full bg-foreground border-0 shrink-0" />
        {/* Connecting line to next event in group (not for last) */}
        {!isLast && (
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.3, delay: index * 0.04 + 0.15, ease: 'easeOut' }}
            style={{ originY: 0 }}
            className="w-px flex-1 bg-border mt-1.5 min-h-[16px]"
          />
        )}
      </div>

      {/* Text content */}
      <div className="flex-1 pb-3 min-w-0">
        <p className="text-sm text-foreground leading-snug">{event.title}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {formatMonthYear(event)}
        </p>
        {event.description && (
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
            {event.description}
          </p>
        )}
      </div>

      {/* Delete button — appears on hover */}
      <button
        onClick={() => onDelete(event.id)}
        disabled={isPending}
        aria-label={`Remove "${event.title}"`}
        className="shrink-0 pt-[3px] text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all duration-150 disabled:opacity-30 text-xs leading-none"
      >
        ×
      </button>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────
   Today terminal marker
───────────────────────────────────────────── */

function TodayMarker({
  eventIndex,
  hasCurrentYear,
}: {
  eventIndex: number
  hasCurrentYear: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: eventIndex * 0.04 + (hasCurrentYear ? 0 : 0.06),
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className="flex items-center gap-3 mt-6"
    >
      <span className="text-label shrink-0">Today</span>
      <div className="flex-1 h-px bg-border" />
    </motion.div>
  )
}
