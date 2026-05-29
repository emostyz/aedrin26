import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FadeUp } from '@/components/ui/motion'
import { ArchiveClient } from '@/components/archive/archive-client'
import type { Database } from '@/lib/supabase/types'

type SoulEntry = Database['public']['Tables']['soul_entries']['Row']

export default async function ArchivePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('soul_entries')
    .select('*')
    .eq('user_id', user.id)
    .is('bound_recipient_id', null)
    .order('created_at', { ascending: false })

  const entries = (data ?? []) as SoulEntry[]

  if (entries.length === 0) {
    return (
      <div className="space-y-8">
        <FadeUp className="space-y-2">
          <p className="text-label">Archive</p>
          <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
            Your story, month by month.
          </p>
        </FadeUp>
        <FadeUp delay={0.1}>
          <div className="border border-border rounded-xl px-5 py-12 text-center">
            <p className="text-sm text-muted-foreground">No entries yet. Start in Capture.</p>
          </div>
        </FadeUp>
      </div>
    )
  }

  // Compute per-month stats server-side for the header
  const monthStats = (() => {
    const map = new Map<string, { entries: number; words: number }>()
    for (const e of entries) {
      const key = e.created_at.slice(0, 7) // YYYY-MM
      const words = e.content.trim().split(/\s+/).filter(Boolean).length
      const existing = map.get(key) ?? { entries: 0, words: 0 }
      map.set(key, { entries: existing.entries + 1, words: existing.words + words })
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  })()

  const mostProductiveMonth = monthStats.reduce(
    (best, [key, stats]) => (!best || stats.words > best.words ? { key, ...stats } : best),
    null as null | { key: string; entries: number; words: number }
  )

  // Compute per-year stats for year cards
  const yearStats = (() => {
    const map = new Map<string, { entries: number; words: number }>()
    for (const e of entries) {
      const year = e.created_at.slice(0, 4) // YYYY
      const words = e.content.trim().split(/\s+/).filter(Boolean).length
      const existing = map.get(year) ?? { entries: 0, words: 0 }
      map.set(year, { entries: existing.entries + 1, words: existing.words + words })
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  })()

  return (
    <div className="space-y-10">
      <FadeUp className="space-y-2">
        <p className="text-label">Archive</p>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          Your story, month by month.
        </p>
        {mostProductiveMonth && (
          <p className="text-xs text-muted-foreground">
            {entries.length.toLocaleString()} entries across {monthStats.length} month{monthStats.length !== 1 ? 's' : ''}.
            {' '}Most words written:{' '}
            <span className="text-foreground">
              {new Date(mostProductiveMonth.key + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            {' '}({mostProductiveMonth.words.toLocaleString()} words).
          </p>
        )}
      </FadeUp>

      {/* Year cards */}
      {yearStats.length > 0 && (
        <FadeUp delay={0.04}>
          <div className="space-y-2">
            <p className="text-label">Year in review</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {yearStats.map(([year, stats]) => (
                <Link
                  key={year}
                  href={`/app/archive/${year}`}
                  className="group border border-border/60 rounded-xl px-4 py-4 hover:border-border hover:bg-surface/30 transition-all space-y-1"
                >
                  <p className="text-lg font-light tracking-[-0.02em] text-foreground group-hover:text-foreground">
                    {year}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {stats.entries} {stats.entries === 1 ? 'entry' : 'entries'} ·{' '}
                    {stats.words.toLocaleString()} words
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                    View year →
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </FadeUp>
      )}

      <ArchiveClient entries={entries} />
    </div>
  )
}
