'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { EntryCard } from './entry-card'
import { ReadingMode } from './reading-mode'
import type { Database, Domain } from '@/lib/supabase/types'

type SoulEntry = Database['public']['Tables']['soul_entries']['Row']

const DOMAIN_LABELS: Record<Domain, string> = {
  childhood: 'Childhood', family: 'Family', career: 'Career',
  values: 'Values', beliefs: 'Beliefs', lessons: 'Lessons',
  messages: 'Messages', other: 'Other',
}

type SortOrder = 'newest' | 'oldest' | 'longest'

interface Props {
  entries:   SoulEntry[]
  promptMap: Record<string, string | null>
  domains:   Domain[]
}

export function ReviewClient({ entries, promptMap, domains }: Props) {
  const [activeDomain, setActiveDomain]   = useState<Domain | 'all'>('all')
  const [search, setSearch]               = useState('')
  const [sharingFilter, setSharingFilter] = useState<'all' | 'private' | 'shareable'>('all')
  const [sortOrder, setSortOrder]         = useState<SortOrder>('newest')
  const [randomEntry, setRandomEntry]     = useState<SoulEntry | null>(null)

  function surpriseMe() {
    if (entries.length === 0) return
    const pick = entries[Math.floor(Math.random() * entries.length)]
    setRandomEntry(pick)
  }

  const filtered = useMemo(() => {
    let result = [...entries]
    if (activeDomain !== 'all') result = result.filter((e) => e.domain === activeDomain)
    if (sharingFilter !== 'all') result = result.filter((e) => e.sharing_status === sharingFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((e) => e.content.toLowerCase().includes(q))
    }
    // Sort
    if (sortOrder === 'oldest') result = result.sort((a, b) => a.created_at.localeCompare(b.created_at))
    else if (sortOrder === 'newest') result = result.sort((a, b) => b.created_at.localeCompare(a.created_at))
    else if (sortOrder === 'longest') result = result.sort((a, b) =>
      b.content.trim().split(/\s+/).filter(Boolean).length -
      a.content.trim().split(/\s+/).filter(Boolean).length
    )
    return result
  }, [entries, activeDomain, search, sharingFilter, sortOrder])

  // Group by domain for the "all" view, flat for filtered view
  const grouped = useMemo(() => {
    if (activeDomain !== 'all') return null
    const map = new Map<Domain, SoulEntry[]>()
    for (const e of filtered) {
      if (!map.has(e.domain as Domain)) map.set(e.domain as Domain, [])
      map.get(e.domain as Domain)!.push(e)
    }
    return map
  }, [filtered, activeDomain])

  return (
    <>
      {/* Random entry reading mode */}
      <AnimatePresence>
        {randomEntry && (
          <ReadingMode
            entry={{
              id: randomEntry.id,
              domain: randomEntry.domain as Domain,
              content: randomEntry.content,
              created_at: randomEntry.created_at,
              sharing_status: randomEntry.sharing_status,
            }}
            promptText={promptMap[randomEntry.id] ?? null}
            onClose={() => setRandomEntry(null)}
          />
        )}
      </AnimatePresence>

    <div className="space-y-8">
      {/* Filter bar */}
      <div className="space-y-3">
        {/* Domain tabs */}
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

        {/* Search + sharing filter + sort + surprise */}
        <div className="flex gap-2 flex-wrap">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entries…"
            className="flex-1 min-w-40 bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <select
            value={sharingFilter}
            onChange={(e) => setSharingFilter(e.target.value as 'all' | 'private' | 'shareable')}
            className="bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All visibility</option>
            <option value="private">Only me</option>
            <option value="shareable">For heirs</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="longest">Longest first</option>
          </select>
          <button
            type="button"
            onClick={surpriseMe}
            title="Open a random entry"
            className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:border-foreground/20 hover:text-foreground transition-all"
          >
            ✦ Surprise me
          </button>
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {search ? `No entries matching "${search}".` : 'No entries in this filter.'}
        </p>
      )}

      {grouped ? (
        /* All domains — grouped */
        <div className="space-y-10">
          {[...grouped.entries()].map(([domain, domainEntries]) => (
            <motion.section
              key={domain}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <p className="text-label">{DOMAIN_LABELS[domain] ?? domain}</p>
              <div className="space-y-2">
                {domainEntries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    promptText={promptMap[entry.id] ?? null}
                  />
                ))}
              </div>
            </motion.section>
          ))}
        </div>
      ) : (
        /* Single domain — flat list */
        <div className="space-y-2">
          {filtered.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              promptText={promptMap[entry.id] ?? null}
            />
          ))}
        </div>
      )}
    </div>
    </>
  )
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
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
