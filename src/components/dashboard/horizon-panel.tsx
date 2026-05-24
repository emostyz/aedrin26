'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { addHorizonItem, resolveHorizonItem, generateHorizonConnections } from '@/app/actions/horizon'
import type { HorizonItem, HorizonItemType, HorizonConnection } from '@/lib/supabase/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_META: Record<HorizonItemType, { label: string; color: string; dot: string }> = {
  event:    { label: 'Event',    color: 'text-blue-500',   dot: 'bg-blue-400'   },
  decision: { label: 'Decision', color: 'text-amber-500',  dot: 'bg-amber-400'  },
  concern:  { label: 'Concern',  color: 'text-rose-500',   dot: 'bg-rose-400'   },
  goal:     { label: 'Goal',     color: 'text-emerald-500',dot: 'bg-emerald-400'},
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDaysUntil(dueDateStr: string | null): string | null {
  if (!dueDateStr) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(dueDateStr + 'T00:00:00')
  const diff = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0)  return `${Math.abs(diff)}d ago`
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff < 7)  return `in ${diff} days`
  if (diff < 30) return `in ${Math.round(diff / 7)}w`
  if (diff < 365) return `in ${Math.round(diff / 30)}mo`
  return `in ${Math.round(diff / 365)}y`
}

// ── Add form ─────────────────────────────────────────────────────────────────

function AddForm({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<HorizonItemType>('event')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => { titleRef.current?.focus() }, [])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('type', type)
    setError(null)
    startTransition(async () => {
      const result = await addHorizonItem(fd)
      if (result.error) { setError(result.error); return }
      onClose()
    })
  }

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
      onSubmit={handleSubmit}
      className="overflow-hidden"
    >
      <div className="border border-border rounded-xl p-5 space-y-4 bg-surface/60 mt-3">

        {/* Type selector */}
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(TYPE_META) as HorizonItemType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-3 py-1 rounded-full text-xs border transition-all ${
                type === t
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
              }`}
            >
              {TYPE_META[t].label}
            </button>
          ))}
        </div>

        {/* Title */}
        <input
          ref={titleRef}
          name="title"
          type="text"
          required
          placeholder={
            type === 'event'    ? 'e.g. Dad\'s surgery next month' :
            type === 'decision' ? 'e.g. Accept the job offer in London?' :
            type === 'concern'  ? 'e.g. Feeling disconnected from old friends' :
                                  'e.g. Write 500 words every morning'
          }
          maxLength={200}
          className="w-full bg-transparent border-b border-border text-sm text-foreground placeholder:text-muted-foreground/50 pb-2 focus:outline-none focus:border-foreground/50 transition-colors"
        />

        {/* Description (optional) */}
        <textarea
          name="description"
          placeholder="Any context you want to capture… (optional)"
          maxLength={2000}
          rows={2}
          className="w-full bg-transparent border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/40 p-3 resize-none focus:outline-none focus:border-foreground/30 transition-colors"
        />

        {/* Due date (optional) */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted-foreground shrink-0">Due</label>
          <input
            name="due_date"
            type="date"
            className="bg-transparent text-sm text-foreground border-b border-border pb-1 focus:outline-none focus:border-foreground/50 transition-colors cursor-pointer"
          />
        </div>

        {error && <p className="text-xs text-rose-500">{error}</p>}

        {/* Actions */}
        <div className="flex items-center gap-4 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="text-sm text-foreground border border-foreground/20 rounded-lg px-4 py-1.5 hover:bg-foreground/5 transition-colors disabled:opacity-40"
          >
            {isPending ? 'Adding…' : 'Add to horizon'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.form>
  )
}

// ── Connections panel ─────────────────────────────────────────────────────────

function ConnectionsPanel({
  item,
  onClose,
}: {
  item: HorizonItem
  onClose: () => void
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [result, setResult] = useState<{ connections: HorizonConnection[]; framing: string } | null>(null)

  useEffect(() => {
    setState('loading')
    generateHorizonConnections(item.id, item.type, item.title, item.description).then((r) => {
      setResult(r)
      setState('done')
    })
  }, [item])

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.3 }}
      className="mt-3 space-y-4"
    >
      {/* Loading shimmer */}
      {state === 'loading' && (
        <div className="space-y-2">
          {[100, 80, 90].map((w, i) => (
            <motion.div
              key={i}
              className="h-3 bg-muted-foreground/10 rounded-full"
              style={{ width: `${w}%` }}
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
          <p className="text-[10px] text-muted-foreground/50 pt-1">Reading your story…</p>
        </div>
      )}

      {/* Results */}
      {state === 'done' && result && (
        <div className="space-y-4">
          {/* Framing */}
          {result.framing && (
            <p className="text-sm text-foreground/80 font-light leading-relaxed italic">
              {result.framing}
            </p>
          )}

          {/* Connections */}
          {result.connections.length > 0 ? (
            <div className="space-y-3">
              {result.connections.map((c, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.3 }}
                  className="border-l-2 border-border pl-3 space-y-1"
                >
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {c.source_domain} · {c.relevance}
                  </p>
                  <p className="text-sm text-foreground font-light leading-relaxed">
                    {c.insight}
                  </p>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground font-light">
              Not enough recorded memories yet to draw specific connections. Keep capturing your story.
            </p>
          )}

          <button
            type="button"
            onClick={onClose}
            className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </motion.div>
  )
}

// ── Horizon item card ─────────────────────────────────────────────────────────

function HorizonCard({ item }: { item: HorizonItem }) {
  const [showConnections, setShowConnections] = useState(false)
  const [resolving, startResolve] = useTransition()
  const [showDesc, setShowDesc] = useState(false)
  const meta = TYPE_META[item.type]
  const countdown = formatDaysUntil(item.due_date)

  function handleResolve() {
    startResolve(async () => {
      await resolveHorizonItem(item.id)
    })
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.3 }}
      className={`border border-border rounded-xl p-4 space-y-3 transition-opacity ${resolving ? 'opacity-40 pointer-events-none' : ''}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {/* Type dot */}
          <span className={`shrink-0 w-1.5 h-1.5 rounded-full mt-0.5 ${meta.dot}`} />
          <p className="text-sm text-foreground font-normal leading-snug truncate">{item.title}</p>
        </div>

        {/* Meta: type + countdown */}
        <div className="flex items-center gap-2 shrink-0">
          {countdown && (
            <span className="text-[10px] text-muted-foreground tabular-nums">{countdown}</span>
          )}
          <span className={`text-[10px] font-medium uppercase tracking-wider ${meta.color}`}>
            {meta.label}
          </span>
        </div>
      </div>

      {/* Description toggle */}
      {item.description && (
        <div>
          <AnimatePresence initial={false}>
            {showDesc && (
              <motion.p
                key="desc"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22 }}
                className="text-xs text-muted-foreground leading-relaxed overflow-hidden"
              >
                {item.description}
              </motion.p>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => setShowDesc((v) => !v)}
            className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors mt-1"
          >
            {showDesc ? 'Hide' : 'Show notes'}
          </button>
        </div>
      )}

      {/* Connections panel */}
      <AnimatePresence>
        {showConnections && (
          <ConnectionsPanel item={item} onClose={() => setShowConnections(false)} />
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex items-center gap-4 pt-0.5">
        {!showConnections && (
          <button
            type="button"
            onClick={() => setShowConnections(true)}
            className="text-xs text-foreground/70 hover:text-foreground transition-colors"
          >
            What does your story say? →
          </button>
        )}
        <button
          type="button"
          onClick={handleResolve}
          className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors ml-auto"
        >
          {resolving ? 'Resolving…' : 'Resolve ✓'}
        </button>
      </div>
    </motion.div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface HorizonPanelProps {
  initialItems: HorizonItem[]
}

export function HorizonPanel({ initialItems }: HorizonPanelProps) {
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border w-0" />
          <p className="text-label">On the horizon</p>
        </div>
        <motion.button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          whileTap={{ scale: 0.93 }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg px-3 py-1"
        >
          {showAdd ? '✕ Cancel' : '+ Add'}
        </motion.button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && <AddForm onClose={() => setShowAdd(false)} />}
      </AnimatePresence>

      {/* Item list */}
      <AnimatePresence mode="popLayout">
        {initialItems.length === 0 && !showAdd ? (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-muted-foreground font-light"
          >
            Capture what&apos;s coming — decisions, events, things on your mind. Your story will help you navigate it.
          </motion.p>
        ) : (
          initialItems.map((item) => <HorizonCard key={item.id} item={item} />)
        )}
      </AnimatePresence>
    </div>
  )
}
