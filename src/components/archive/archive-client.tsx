'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { EntryCard } from '@/components/review/entry-card'
import type { Database, Domain } from '@/lib/supabase/types'

type SoulEntry = Database['public']['Tables']['soul_entries']['Row']

const DOMAIN_LABELS: Record<Domain, string> = {
  childhood: 'Childhood', family: 'Family', career: 'Career',
  values: 'Values', beliefs: 'Beliefs', lessons: 'Lessons',
  messages: 'Messages', other: 'Other',
}

const DOMAIN_COLORS: Record<Domain, string> = {
  childhood: 'text-amber-600 dark:text-amber-400',
  family:    'text-rose-600 dark:text-rose-400',
  career:    'text-blue-600 dark:text-blue-400',
  values:    'text-emerald-600 dark:text-emerald-400',
  beliefs:   'text-violet-600 dark:text-violet-400',
  lessons:   'text-orange-600 dark:text-orange-400',
  messages:  'text-teal-600 dark:text-teal-400',
  other:     'text-muted-foreground',
}

interface Props {
  entries: SoulEntry[]
}

interface MonthGroup {
  key: string        // YYYY-MM
  label: string      // "January 2024"
  entries: SoulEntry[]
  wordCount: number
  domainCounts: Partial<Record<Domain, number>>
}

export function ArchiveClient({ entries }: Props) {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(() => {
    // Default: expand the most recent month
    if (entries.length === 0) return null
    return entries[0].created_at.slice(0, 7)
  })

  const months: MonthGroup[] = useMemo(() => {
    const map = new Map<string, SoulEntry[]>()
    for (const e of entries) {
      const key = e.created_at.slice(0, 7)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, monthEntries]) => {
        const wordCount = monthEntries.reduce(
          (sum, e) => sum + e.content.trim().split(/\s+/).filter(Boolean).length, 0
        )
        const domainCounts = monthEntries.reduce<Partial<Record<Domain, number>>>((acc, e) => {
          const d = e.domain as Domain
          acc[d] = (acc[d] ?? 0) + 1
          return acc
        }, {})
        const label = new Date(key + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        return { key, label, entries: monthEntries, wordCount, domainCounts }
      })
  }, [entries])

  return (
    <div className="space-y-2">
      {months.map((month) => {
        const isOpen = expandedMonth === month.key
        const topDomains = (Object.entries(month.domainCounts) as [Domain, number][])
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)

        return (
          <motion.div
            key={month.key}
            layout
            className="border border-border rounded-xl overflow-hidden"
          >
            {/* Month header */}
            <button
              type="button"
              onClick={() => setExpandedMonth(isOpen ? null : month.key)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface/30 transition-colors text-left"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{month.label}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">
                      {month.entries.length} {month.entries.length === 1 ? 'entry' : 'entries'}
                      {' · '}
                      {month.wordCount.toLocaleString()} words
                    </span>
                    {topDomains.map(([domain, count]) => (
                      <span key={domain} className={`text-[10px] ${DOMAIN_COLORS[domain]}`}>
                        {DOMAIN_LABELS[domain]} ({count})
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 ml-4">
                {/* Mini domain bar */}
                <div className="hidden sm:flex items-center gap-0.5">
                  {(Object.entries(month.domainCounts) as [Domain, number][])
                    .sort((a, b) => b[1] - a[1])
                    .map(([domain, count]) => {
                      const pct = Math.max(8, Math.round((count / month.entries.length) * 60))
                      return (
                        <div
                          key={domain}
                          className={`h-4 rounded-sm opacity-60 ${domainBg(domain)}`}
                          style={{ width: `${pct}px` }}
                          title={`${DOMAIN_LABELS[domain]}: ${count}`}
                        />
                      )
                    })}
                </div>

                <motion.svg
                  width="14" height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-muted-foreground/50 shrink-0"
                >
                  <polyline points="6 9 12 15 18 9" />
                </motion.svg>
              </div>
            </button>

            {/* Entries */}
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="entries"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border/40 px-5 py-4 space-y-2">
                    {month.entries.map((entry) => (
                      <EntryCard key={entry.id} entry={entry} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </div>
  )
}

function domainBg(domain: Domain): string {
  const map: Record<Domain, string> = {
    childhood: 'bg-amber-500',
    family:    'bg-rose-500',
    career:    'bg-blue-500',
    values:    'bg-emerald-500',
    beliefs:   'bg-violet-500',
    lessons:   'bg-orange-500',
    messages:  'bg-teal-500',
    other:     'bg-muted-foreground',
  }
  return map[domain] ?? 'bg-muted-foreground'
}
