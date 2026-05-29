'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { extractPeopleFromStory, type Person } from '@/app/actions/extract-people'

const DOMAIN_COLORS: Record<string, string> = {
  childhood: 'text-amber-400/80',
  family:    'text-rose-400/80',
  career:    'text-blue-400/80',
  values:    'text-emerald-400/80',
  beliefs:   'text-violet-400/80',
  lessons:   'text-orange-400/80',
  messages:  'text-teal-400/80',
  other:     'text-muted-foreground/60',
}

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').slice(0, 2).join('')
}

interface Props {
  entryCount: number
}

export function PeopleExtract({ entryCount }: Props) {
  const [people, setPeople] = useState<Person[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleExtract() {
    setError(null)
    startTransition(async () => {
      const result = await extractPeopleFromStory()
      if (result.error || result.people.length === 0) {
        setError(result.error ?? 'No people found in your entries yet.')
        return
      }
      setPeople(result.people)
    })
  }

  if (entryCount < 2) {
    return (
      <div className="border border-border/40 rounded-xl px-5 py-10 text-center space-y-2">
        <p className="text-sm text-muted-foreground">Write at least 2 memories first.</p>
        <Link href="/app/interview" className="text-xs text-foreground underline underline-offset-4">
          Start capturing →
        </Link>
      </div>
    )
  }

  if (!people) {
    return (
      <div className="space-y-6">
        <div className="border border-dashed border-border rounded-xl px-6 py-10 text-center space-y-4">
          <p className="text-sm font-light text-foreground">Discover who appears in your story</p>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
            The AI will read your {entryCount} {entryCount === 1 ? 'memory' : 'memories'} and identify everyone you&apos;ve written about, then write a brief character sketch for each.
          </p>

          <AnimatePresence mode="wait">
            {isPending ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3"
              >
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-foreground/20"
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Reading your story…</p>
              </motion.div>
            ) : (
              <motion.button
                key="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                type="button"
                onClick={handleExtract}
                className="bg-foreground text-background rounded-lg px-6 py-2.5 text-sm font-light hover:opacity-90 transition-opacity"
              >
                ✦ Find the people in my story
              </motion.button>
            )}
          </AnimatePresence>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {people.length} {people.length === 1 ? 'person' : 'people'} found in your story
        </p>
        <button
          type="button"
          onClick={() => { setPeople(null); setError(null) }}
          className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          Re-extract
        </button>
      </div>

      {/* People grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {people.map((person, i) => (
          <motion.div
            key={`${person.name}-${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className="border border-border/50 rounded-xl p-4 space-y-3 hover:border-border transition-colors"
          >
            {/* Avatar + name */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-foreground/8 border border-border/40 flex items-center justify-center shrink-0">
                <span className="text-xs text-foreground/60 font-light">{initials(person.name)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{person.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{person.relationship}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] text-muted-foreground/50 tabular-nums">
                  {person.mentionCount} {person.mentionCount === 1 ? 'entry' : 'entries'}
                </p>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-muted-foreground leading-relaxed font-light">
              {person.description}
            </p>

            {/* Domains */}
            {person.domains && person.domains.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {person.domains.map((d) => (
                  <span
                    key={d}
                    className={`text-[10px] capitalize ${DOMAIN_COLORS[d] ?? 'text-muted-foreground/60'}`}
                  >
                    {d}
                  </span>
                ))}
              </div>
            )}

            {/* Search link */}
            <Link
              href={`/app/search?q=${encodeURIComponent(person.name)}`}
              className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              Find all entries →
            </Link>
          </motion.div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground/40 text-center">
        Based on {entryCount} entries. Extracted by AI — re-extract as you write more.
      </p>
    </div>
  )
}
