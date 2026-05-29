import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FadeUp } from '@/components/ui/motion'
import type { Database, Domain } from '@/lib/supabase/types'

type SoulEntry = Database['public']['Tables']['soul_entries']['Row']

const DOMAIN_LABELS: Record<Domain, string> = {
  childhood: 'Childhood',
  family: 'Family',
  career: 'Career',
  values: 'Values',
  beliefs: 'Beliefs',
  lessons: 'Lessons',
  messages: 'Messages',
  other: 'Other',
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

const DOMAIN_BG: Record<Domain, string> = {
  childhood: 'bg-amber-500',
  family:    'bg-rose-500',
  career:    'bg-blue-500',
  values:    'bg-emerald-500',
  beliefs:   'bg-violet-500',
  lessons:   'bg-orange-500',
  messages:  'bg-teal-500',
  other:     'bg-muted-foreground',
}

const DOMAIN_BORDER: Record<Domain, string> = {
  childhood: 'border-l-amber-500',
  family:    'border-l-rose-500',
  career:    'border-l-blue-500',
  values:    'border-l-emerald-500',
  beliefs:   'border-l-violet-500',
  lessons:   'border-l-orange-500',
  messages:  'border-l-teal-500',
  other:     'border-l-border',
}

function wordCount(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length
}

function longestStreakCalc(entries: SoulEntry[]): number {
  if (entries.length === 0) return 0
  const days = new Set<string>()
  for (const e of entries) {
    days.add(e.created_at.slice(0, 10))
  }
  const sorted = [...days].sort()
  let best = 1
  let current = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1])
    const curr = new Date(sorted[i])
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    if (diff === 1) {
      current++
      if (current > best) best = current
    } else {
      current = 1
    }
  }
  return best
}

export default async function YearInReviewPage({
  params,
}: {
  params: Promise<{ year: string }>
}) {
  const { year } = await params

  // Validate year is a 4-digit number
  if (!/^\d{4}$/.test(year)) redirect('/app/archive')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const yearNum = parseInt(year, 10)
  const startDate = `${yearNum}-01-01`
  const endDate = `${yearNum + 1}-01-01`

  const [entriesRes, profileRes, heirsRes] = await Promise.all([
    supabase
      .from('soul_entries')
      .select('*')
      .eq('user_id', user.id)
      .is('bound_recipient_id', null)
      .gte('created_at', startDate)
      .lt('created_at', endDate)
      .order('created_at', { ascending: true }),
    supabase
      .from('users')
      .select('legal_name, display_name')
      .eq('id', user.id)
      .single(),
    supabase.from('heirs').select('id').eq('user_id', user.id),
  ])

  const entries = (entriesRes.data ?? []) as SoulEntry[]
  const profile = profileRes.data
  const heirCount = heirsRes.data?.length ?? 0

  if (entries.length === 0) {
    return (
      <div className="space-y-8">
        <Link
          href="/app/archive"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Archive
        </Link>
        <FadeUp className="space-y-3">
          <p className="text-label">Year in review</p>
          <p className="text-[2.5rem] font-light tracking-[-0.04em] text-foreground leading-tight">
            {year}
          </p>
        </FadeUp>
        <FadeUp delay={0.1}>
          <div className="border border-border rounded-xl px-5 py-12 text-center space-y-3">
            <p className="text-sm text-muted-foreground">No entries for {year}.</p>
            <Link
              href="/app/archive"
              className="text-xs text-foreground underline underline-offset-4"
            >
              ← Back to Archive
            </Link>
          </div>
        </FadeUp>
      </div>
    )
  }

  // ── Compute stats ────────────────────────────────────────────────────────────
  const totalEntries = entries.length
  const totalWords = entries.reduce((sum, e) => sum + wordCount(e.content), 0)

  const wordsByMonth: Record<string, number> = {}
  const entriesByMonth: Record<string, number> = {}
  const countByDomain: Partial<Record<Domain, number>> = {}

  for (const e of entries) {
    const month = e.created_at.slice(0, 7) // YYYY-MM
    const wc = wordCount(e.content)
    wordsByMonth[month] = (wordsByMonth[month] ?? 0) + wc
    entriesByMonth[month] = (entriesByMonth[month] ?? 0) + 1

    const d = e.domain as Domain
    countByDomain[d] = (countByDomain[d] ?? 0) + 1
  }

  const activeDays = new Set(entries.map((e) => e.created_at.slice(0, 10))).size
  const avgWordsPerSession = Math.round(totalWords / totalEntries)
  const longestStreak = longestStreakCalc(entries)

  const topEntry = entries.reduce<SoulEntry | null>((best, e) => {
    if (!best) return e
    return wordCount(e.content) > wordCount(best.content) ? e : best
  }, null)

  const firstEntry = entries[0]
  const lastEntry = entries[entries.length - 1]

  const maxMonthWords = Math.max(...Object.values(wordsByMonth))
  const sortedMonths = Object.keys(wordsByMonth).sort()

  const displayName =
    profile?.display_name ?? profile?.legal_name ?? 'You'

  return (
    <div className="space-y-16">
      {/* Back link */}
      <Link
        href="/app/archive"
        className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-block"
      >
        ← Archive
      </Link>

      {/* Hero header */}
      <FadeUp className="space-y-3">
        <p className="text-label">Year in review</p>
        <p className="text-[2.5rem] font-light tracking-[-0.04em] text-foreground leading-tight">
          {year}
        </p>
        <p className="text-sm text-muted-foreground">
          {totalEntries} {totalEntries === 1 ? 'entry' : 'entries'} ·{' '}
          {totalWords.toLocaleString()} words · {activeDays} day
          {activeDays !== 1 ? 's' : ''} active
        </p>
      </FadeUp>

      {/* Stats grid */}
      <FadeUp delay={0.05}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { value: totalEntries.toLocaleString(), label: 'entries written' },
            { value: totalWords.toLocaleString(), label: 'words captured' },
            { value: `${activeDays}`, label: 'days active' },
            { value: `${longestStreak}`, label: 'day best streak' },
          ].map(({ value, label }) => (
            <div
              key={label}
              className="border border-border/60 rounded-xl px-4 py-4 text-center space-y-1"
            >
              <p className="text-xl font-light tracking-[-0.02em] text-foreground">{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </FadeUp>

      {/* Domain breakdown */}
      <FadeUp delay={0.08}>
        <div className="space-y-3">
          <p className="text-label">By domain</p>
          <div className="space-y-2">
            {(Object.entries(countByDomain) as [Domain, number][])
              .sort((a, b) => b[1] - a[1])
              .map(([domain, count]) => {
                const pct = Math.round((count / totalEntries) * 100)
                return (
                  <div key={domain} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${DOMAIN_COLORS[domain]}`}>
                        {DOMAIN_LABELS[domain]}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {count} {count === 1 ? 'entry' : 'entries'} · {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${DOMAIN_BG[domain]} opacity-70`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </FadeUp>

      {/* Word count by month */}
      <FadeUp delay={0.1}>
        <div className="space-y-3">
          <p className="text-label">Month by month</p>
          <div className="space-y-2">
            {sortedMonths.map((month) => {
              const mWords = wordsByMonth[month]
              const mEntries = entriesByMonth[month]
              const barPct = Math.round((mWords / maxMonthWords) * 100)
              const label = new Date(month + '-01').toLocaleDateString('en-US', {
                month: 'long',
              })
              return (
                <div key={month} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground">{label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {mEntries} {mEntries === 1 ? 'entry' : 'entries'} ·{' '}
                      {mWords.toLocaleString()} words
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-foreground/30"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </FadeUp>

      {/* Top entry */}
      {topEntry && (
        <FadeUp delay={0.12}>
          <div className="space-y-3">
            <p className="text-label">Longest entry this year</p>
            <div
              className={`border border-l-2 border-border rounded-xl px-5 py-4 space-y-2 ${DOMAIN_BORDER[topEntry.domain as Domain]}`}
            >
              <p className="text-sm text-muted-foreground">
                {DOMAIN_LABELS[topEntry.domain as Domain]} ·{' '}
                {new Date(topEntry.created_at).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              <p className="text-sm text-foreground leading-relaxed font-light line-clamp-8">
                {topEntry.content}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {wordCount(topEntry.content).toLocaleString()} words
              </p>
            </div>
          </div>
        </FadeUp>
      )}

      {/* How the year began */}
      {firstEntry && (
        <FadeUp delay={0.14}>
          <div className="space-y-3">
            <p className="text-label">How {year} began</p>
            <div
              className={`border border-l-2 border-border rounded-xl px-5 py-4 space-y-2 ${DOMAIN_BORDER[firstEntry.domain as Domain]}`}
            >
              <p className="text-sm text-muted-foreground">
                {DOMAIN_LABELS[firstEntry.domain as Domain]} ·{' '}
                {new Date(firstEntry.created_at).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              <p className="text-sm text-foreground leading-relaxed font-light line-clamp-8">
                {firstEntry.content}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {wordCount(firstEntry.content).toLocaleString()} words
              </p>
            </div>
          </div>
        </FadeUp>
      )}

      {/* Additional context */}
      {heirCount > 0 && (
        <FadeUp delay={0.16}>
          <div className="border border-border/60 rounded-xl px-5 py-4 space-y-1">
            <p className="text-xs text-muted-foreground">
              {heirCount} {heirCount === 1 ? 'heir' : 'heirs'} named to receive your legacy.
            </p>
          </div>
        </FadeUp>
      )}

      {/* Bottom nav */}
      <FadeUp delay={0.2}>
        <div className="border-t border-border pt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Link href="/app/archive" className="hover:text-foreground transition-colors">
            ← All years
          </Link>
          <Link href="/app/review" className="hover:text-foreground transition-colors">
            Review all entries →
          </Link>
          <Link href="/app/export" className="hover:text-foreground transition-colors">
            Export →
          </Link>
        </div>
      </FadeUp>
    </div>
  )
}
