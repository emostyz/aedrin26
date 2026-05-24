'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence, Stagger, StaggerItem } from '@/components/ui/motion'
import { createLifeEvent, deleteLifeEvent } from '@/app/actions/life-events'
import type { Database } from '@/lib/supabase/types'

type LifeEvent = Database['public']['Tables']['life_events']['Row']

function byDate(a: LifeEvent, b: LifeEvent) {
  const ad = a.event_date ?? a.created_at
  const bd = b.event_date ?? b.created_at
  return ad < bd ? -1 : ad > bd ? 1 : 0
}

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

  const sorted = [...events].sort(byDate)

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {events.length === 0 ? 'No events yet.' : `${events.length} events`}
        </p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <form action={handleAdd} className="border border-border rounded-lg px-5 py-5 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="ev-title" className="text-label">Title *</label>
                <input id="ev-title" name="title" required
                  placeholder="e.g. Born in Stockholm"
                  className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="ev-date" className="text-label">Date <span className="normal-case font-normal text-muted-foreground">(optional)</span></label>
                <input id="ev-date" name="event_date" type="date"
                  className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="ev-desc" className="text-label">Description <span className="normal-case font-normal text-muted-foreground">(optional)</span></label>
                <textarea id="ev-desc" name="description" rows={3}
                  className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
              </div>
              {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
              <button type="submit" disabled={isPending}
                className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity">
                {isPending ? 'Adding…' : 'Add event'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {sorted.length === 0 ? (
        <div className="border border-border rounded-lg px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">Add the moments that shaped your life.</p>
        </div>
      ) : (
        <Stagger className="relative ml-px space-y-0">
          {sorted.map((event, i) => (
            <StaggerItem key={event.id}>
              <div className="relative pl-8 pb-8">
                {/* Timeline line */}
                {i < sorted.length - 1 && (
                  <div className="absolute left-[5px] top-3 bottom-0 w-px bg-border" />
                )}
                {/* Dot */}
                <div className="absolute left-0 top-[5px] w-[11px] h-[11px] rounded-full border border-border bg-background" />

                <div className="space-y-1">
                  {event.event_date && (
                    <p className="text-label">
                      {new Date(event.event_date + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
                    </p>
                  )}
                  <p className="text-sm text-foreground">{event.title}</p>
                  {event.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{event.description}</p>
                  )}
                  <button onClick={() => handleDelete(event.id)} disabled={isPending}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40">
                    Remove
                  </button>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  )
}
