'use client'

import { useState, useTransition } from 'react'
import { createLifeEvent, deleteLifeEvent } from '@/app/actions/life-events'
import type { Database } from '@/lib/supabase/types'

type LifeEvent = Database['public']['Tables']['life_events']['Row']

interface Props {
  initialEvents: LifeEvent[]
}

export function Timeline({ initialEvents }: Props) {
  const [events, setEvents] = useState<LifeEvent[]>(initialEvents)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdd(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await createLifeEvent(formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      // Optimistic: add a placeholder; real data comes back via revalidation
      const title = formData.get('title') as string
      const eventDate = formData.get('event_date') as string | null
      const description = formData.get('description') as string | null
      setEvents((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          user_id: '',
          title,
          event_date: eventDate || null,
          description: description || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ].sort(byEventDate))
      setShowForm(false)
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteLifeEvent(id)
      if (result?.error) return
      setEvents((prev) => prev.filter((e) => e.id !== id))
    })
  }

  const sorted = [...events].sort(byEventDate)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {events.length === 0
            ? 'No events yet. Add the moments that shaped your life.'
            : `${events.length} ${events.length === 1 ? 'event' : 'events'}`}
        </p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add event'}
        </button>
      </div>

      {showForm && (
        <AddEventForm onSubmit={handleAdd} isPending={isPending} error={error} />
      )}

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-border px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">Your timeline is empty.</p>
        </div>
      ) : (
        <ol className="relative border-l border-border space-y-8 ml-3">
          {sorted.map((event) => (
            <li key={event.id} className="ml-6">
              <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-border bg-background" />
              <div className="space-y-1">
                {event.event_date && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.event_date + 'T00:00:00').toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                    })}
                  </p>
                )}
                <p className="text-sm font-medium text-foreground">{event.title}</p>
                {event.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>
                )}
                <button
                  onClick={() => handleDelete(event.id)}
                  disabled={isPending}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                  aria-label={`Delete event: ${event.title}`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

interface AddEventFormProps {
  onSubmit: (fd: FormData) => void
  isPending: boolean
  error: string | null
}

function AddEventForm({ onSubmit, isPending, error }: AddEventFormProps) {
  return (
    <form
      action={onSubmit}
      className="rounded-lg border border-border px-5 py-5 space-y-4"
    >
      <div className="space-y-1.5">
        <label htmlFor="title" className="text-sm font-medium text-foreground">
          Event title <span aria-hidden="true">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          placeholder="e.g. Born in Malmö"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="event_date" className="text-sm font-medium text-foreground">
          Date <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <input
          id="event_date"
          name="event_date"
          type="date"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="description" className="text-sm font-medium text-foreground">
          Description <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder="A few words about this event…"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? 'Adding…' : 'Add event'}
      </button>
    </form>
  )
}

function byEventDate(a: { event_date: string | null; created_at: string }, b: { event_date: string | null; created_at: string }) {
  const aDate = a.event_date ?? a.created_at
  const bDate = b.event_date ?? b.created_at
  return aDate < bDate ? -1 : aDate > bDate ? 1 : 0
}
