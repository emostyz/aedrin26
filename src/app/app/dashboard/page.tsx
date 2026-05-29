import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { FadeUp, Stagger, StaggerItem } from '@/components/ui/motion'
import { TodayPrompt } from '@/components/dashboard/today-prompt'
import { GuidedSetup } from '@/components/dashboard/guided-setup'
import { DailyInsight } from '@/components/dashboard/daily-insight'
import { HorizonPanel } from '@/components/dashboard/horizon-panel'
import { getOrCreateTodaysPrompt } from '@/app/actions/daily-prompt'
import { getOrCreateTodaysInsight } from '@/app/actions/daily-insight'
import { getHorizonItems } from '@/app/actions/horizon'
import type { Domain } from '@/lib/supabase/types'
import { StreakTracker, type StreakState } from '@/components/dashboard/streak-tracker'
import { OnThisDay } from '@/components/dashboard/on-this-day'
import { Milestones } from '@/components/dashboard/milestones'
import { WordGoal } from '@/components/dashboard/word-goal'

// Domain metadata — colour ring for the completeness arc
const DOMAINS: { domain: Domain; label: string; color: string }[] = [
  { domain: 'childhood', label: 'Childhood', color: '#f59e0b' },
  { domain: 'family',    label: 'Family',    color: '#f43f5e' },
  { domain: 'career',    label: 'Career',    color: '#3b82f6' },
  { domain: 'values',    label: 'Values',    color: '#10b981' },
  { domain: 'beliefs',   label: 'Beliefs',   color: '#8b5cf6' },
  { domain: 'lessons',   label: 'Lessons',   color: '#f97316' },
  { domain: 'messages',  label: 'Messages',  color: '#14b8a6' },
]

// Domain grid colours for the filled-state dot
const DOMAIN_DOT: Record<Domain, string> = {
  childhood: 'bg-amber-400',
  family:    'bg-rose-400',
  career:    'bg-blue-400',
  values:    'bg-emerald-400',
  beliefs:   'bg-violet-400',
  lessons:   'bg-orange-400',
  messages:  'bg-teal-400',
  other:     'bg-muted-foreground',
}

// SVG soul-completeness arc ─────────────────────────────────────────────────
// Renders 7 coloured arc segments around a circle, filled or empty per domain
function SoulRing({ countByDomain }: { countByDomain: Record<string, number> }) {
  const R = 38
  const STROKE = 3
  const GAP_DEG = 4
  const cx = 48, cy = 48
  const circumference = 2 * Math.PI * R
  const segmentDeg = (360 - DOMAINS.length * GAP_DEG) / DOMAINS.length

  const segments = DOMAINS.map((d, i) => {
    const startDeg = i * (segmentDeg + GAP_DEG) - 90
    const endDeg   = startDeg + segmentDeg
    const filled   = (countByDomain[d.domain] ?? 0) > 0

    const toRad = (deg: number) => (deg * Math.PI) / 180
    const x1 = cx + R * Math.cos(toRad(startDeg))
    const y1 = cy + R * Math.sin(toRad(startDeg))
    const x2 = cx + R * Math.cos(toRad(endDeg))
    const y2 = cy + R * Math.sin(toRad(endDeg))
    const large = segmentDeg > 180 ? 1 : 0

    return { d: `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`, filled, color: d.color }
  })

  const filledCount = DOMAINS.filter((d) => (countByDomain[d.domain] ?? 0) > 0).length

  return (
    <div className="relative shrink-0">
      <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden>
        {segments.map((seg, i) => (
          <path
            key={i}
            d={seg.d}
            fill="none"
            stroke={seg.filled ? seg.color : 'oklch(1 0 0 / 0.07)'}
            strokeWidth={STROKE}
            strokeLinecap="round"
            style={{ transition: 'stroke 0.6s ease' }}
          />
        ))}
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[1.1rem] font-light text-foreground leading-none">{filledCount}</span>
        <span className="text-[8px] text-muted-foreground uppercase tracking-wider mt-0.5">of 7</span>
      </div>
    </div>
  )
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ reflect?: string }>
}) {
  const { reflect } = await searchParams
  const autoWrite = reflect === '1'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceClient()

  // Run all data fetches in parallel, including AI generation for today's prompt + insight
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
  const oneYearAgo   = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString()

  // "On this day" — entries written on this same calendar month+day in previous years
  const todayForQuery = new Date()
  const onThisDayFilter = (() => {
    const mm = String(todayForQuery.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(todayForQuery.getUTCDate()).padStart(2, '0')
    // Build OR filter for years 1–7 back
    const parts = Array.from({ length: 7 }, (_, i) => {
      const yr = todayForQuery.getUTCFullYear() - (i + 1)
      return `and(created_at.gte.${yr}-${mm}-${dd}T00:00:00.000Z,created_at.lte.${yr}-${mm}-${dd}T23:59:59.999Z)`
    })
    return parts.join(',')
  })()

  // Batch A — primary data + AI (9 items; TS Promise.all inference works cleanly up to ~9 mixed types)
  const [entriesResult, profileResult, legacyResult, todayPromptResult, todayInsightResult, horizonItems, recentEntriesResult, pastEntriesResult, onThisDayResult] = await Promise.all([
    supabase.from('soul_entries').select('id, domain, content, daily_prompt_id, created_at').eq('user_id', user.id).is('bound_recipient_id', null).order('created_at', { ascending: false }),
    supabase.from('users').select('account_state, legal_name, display_name, setup_complete').eq('id', user.id).single(),
    service.from('heirs').select('id, user_id').eq('email', user.email!.toLowerCase()).eq('access_status', 'active'),
    getOrCreateTodaysPrompt(),
    getOrCreateTodaysInsight(),
    getHorizonItems(),
    // Streak: pull all entries from last 366 days so the count is never capped
    supabase.from('soul_entries')
      .select('created_at')
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 366 * 24 * 3600 * 1000).toISOString())
      .order('created_at', { ascending: false }),
    // Past entries for the "From your journal" card — older than 7 days, up to 1 year back
    supabase.from('soul_entries')
      .select('id, domain, content, created_at')
      .eq('user_id', user.id)
      .is('bound_recipient_id', null)
      .lt('created_at', sevenDaysAgo)
      .gte('created_at', oneYearAgo)
      .order('created_at', { ascending: false })
      .limit(20),
    // "On this day" — same calendar date, previous years
    supabase.from('soul_entries')
      .select('id, domain, content, created_at')
      .eq('user_id', user.id)
      .is('bound_recipient_id', null)
      .or(onThisDayFilter)
      .order('created_at', { ascending: false }),
  ])

  // Batch B — heir count for milestones (separate so Promise.all tuple stays < 10)
  const heirsResult = await supabase.from('heirs').select('id').eq('user_id', user.id)

  const entries = (entriesResult.data ?? []) as { id: string; domain: Domain; content: string; daily_prompt_id: string | null; created_at: string }[]
  const profile = profileResult.data as { account_state: string; legal_name: string; display_name: string | null; setup_complete: boolean } | null
  const legacyHeirs = (legacyResult.data ?? []) as { id: string; user_id: string }[]
  const todayPrompt = todayPromptResult.prompt
  const todayInsight = todayInsightResult.insight

  // "From your journal" — a past entry that rotates deterministically by day
  const pastEntries = (pastEntriesResult.data ?? []) as { id: string; domain: Domain; content: string; created_at: string }[]
  const pastEntry = (() => {
    if (pastEntries.length === 0) return null
    const today = new Date()
    const seed  = today.getFullYear() * 1000 + today.getMonth() * 31 + today.getDate()
    return pastEntries[seed % pastEntries.length] ?? null
  })()

  // "On this day" — entries from same calendar date in previous years
  const onThisDayEntries = (onThisDayResult.data ?? []) as { id: string; domain: Domain; content: string; created_at: string }[]

  // Heir count for milestones
  const heirCount = (heirsResult.data ?? []).length

  // Check if today's prompt has already been answered
  const todayAnsweredEntry = todayPrompt
    ? entries.find((e) => e.daily_prompt_id === todayPrompt.id) ?? null
    : null

  // Streak computation
  const recentDates = (recentEntriesResult.data ?? []).map((e) =>
    new Date(e.created_at).toISOString().slice(0, 10)
  )
  const activeDates = [...new Set(recentDates)]

  function computeStreak(dates: string[]): number {
    const dateSet = new Set(dates)
    let streak = 0
    const today = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const ds = d.toISOString().slice(0, 10)
      if (dateSet.has(ds)) streak++
      else break
    }
    return streak
  }

  function computeStreakState(streak: number, dates: string[]): StreakState {
    if (dates.length === 0) return 'never'
    if (streak === 0) return 'lost'
    if (streak <= 2) return 'new'
    if (streak <= 6) return 'building'
    if (streak <= 13) return 'strong'
    return 'legendary'
  }

  const streakDays = computeStreak(activeDates)
  const streakState = computeStreakState(streakDays, activeDates)

  const countByDomain = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.domain] = (acc[e.domain] ?? 0) + 1
    return acc
  }, {})

  const totalEntries = entries.length
  const totalWords = entries.reduce((sum, e) => {
    return sum + e.content.trim().split(/\s+/).filter(Boolean).length
  }, 0)
  const filledDomains = DOMAINS.filter((d) => (countByDomain[d.domain] ?? 0) > 0).length

  // Today's word count (for the daily word goal widget)
  const todayStr = new Date().toISOString().slice(0, 10)
  const wordsWrittenToday = entries
    .filter((e) => e.created_at.slice(0, 10) === todayStr)
    .reduce((sum, e) => sum + e.content.trim().split(/\s+/).filter(Boolean).length, 0)

  // Resolve legacy_active accounts for this heir
  const legacyAccess: { userId: string; name: string }[] = []
  for (const h of legacyHeirs) {
    const { data } = await service.from('users').select('id, legal_name, display_name, account_state')
      .eq('id', h.user_id).eq('account_state', 'legacy_active').single()
    if (data) {
      const d = data as { id: string; legal_name: string; display_name: string | null; account_state: string }
      legacyAccess.push({ userId: d.id, name: d.display_name ?? d.legal_name })
    }
  }

  const isMemoralizing = profile?.account_state === 'memorializing'
  const firstName = (profile?.display_name ?? profile?.legal_name ?? '').split(' ')[0]
  const setupComplete = profile?.setup_complete ?? true

  return (
    <div className="space-y-16">
      {/* Legacy access */}
      {legacyAccess.length > 0 && (
        <FadeUp>
          <div className="border border-border rounded-xl p-5 space-y-4">
            <p className="text-label">Legacy access</p>
            <div className="space-y-2">
              {legacyAccess.map((a) => (
                <div key={a.userId} className="flex items-center justify-between">
                  <p className="text-sm text-foreground">{a.name}</p>
                  <Link href={`/app/legacy/${a.userId}`}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Open →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </FadeUp>
      )}

      {/* Memorialization warning */}
      {isMemoralizing && (
        <FadeUp>
          <div className="border border-destructive/20 rounded-xl p-5">
            <p className="text-sm text-foreground">A memorialization request is active.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Cancel it during the grace period if this was initiated in error.{' '}
              <Link href="/app/settings/memorialization" className="text-foreground underline underline-offset-4">
                View →
              </Link>
            </p>
          </div>
        </FadeUp>
      )}

      {/* ── Greeting + daily task list ──────────────────────────────── */}
      <div className="space-y-5">
        {/* Header: date + greeting */}
        <FadeUp>
          <div className="space-y-1">
            <p className="text-label">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
              {todayAnsweredEntry
                ? 'You\'re done for today.'
                : firstName ? `Good to see you, ${firstName}.` : 'Good to see you.'}
            </p>
          </div>
        </FadeUp>

        {!setupComplete ? (
          /* First-run guided setup — replaces the daily cadence on day one */
          <FadeUp delay={0.05}>
            <GuidedSetup firstName={firstName} />
          </FadeUp>
        ) : (
          <>
            {/* Task count label */}
            <FadeUp delay={0.03}>
              <p className="text-xs text-muted-foreground">
                {todayAnsweredEntry ? '1 of 1 tasks complete' : '0 of 1 tasks complete'}
              </p>
            </FadeUp>

            {/* The task */}
            <FadeUp delay={0.05}>
              {todayPrompt ? (
                <TodayPrompt
                  promptId={todayPrompt.id}
                  promptText={todayPrompt.prompt_text}
                  domain={todayPrompt.domain}
                  existingEntry={todayAnsweredEntry ? { content: todayAnsweredEntry.content } : null}
                  autoWrite={autoWrite}
                />
              ) : (
                <div className="border border-border rounded-xl p-6 space-y-3">
                  <p className="text-label">Today&apos;s reflection</p>
                  <p className="text-sm text-muted-foreground">
                    Your personalized prompt is being prepared.{' '}
                    <Link href="/app/interview/childhood" className="text-foreground underline underline-offset-4">
                      Browse topics →
                    </Link>
                  </p>
                </div>
              )}
            </FadeUp>

            {/* Come back tomorrow — shown only when today is done */}
            {todayAnsweredEntry && (
              <FadeUp delay={0.1}>
                <div className="rounded-xl border border-border/40 px-6 py-5 space-y-4 bg-surface/20">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {streakDays > 1
                        ? `${streakDays}-day streak. Come back tomorrow.`
                        : 'Come back tomorrow for your next reflection.'}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Daily reflection is how your story gets written. Same time tomorrow.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 border-t border-border/30">
                    <Link href="/app/interview" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Keep going in Capture →
                    </Link>
                    <Link href="/app/memoir" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Read your memoir →
                    </Link>
                    <Link href="/app/lifemap" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Open your life map →
                    </Link>
                  </div>
                </div>
              </FadeUp>
            )}

            {todayInsight && (
              <FadeUp delay={0.12}>
                <DailyInsight
                  insightText={todayInsight.insight_text}
                  recommendation={todayInsight.recommendation}
                  patternSources={todayInsight.pattern_sources}
                />
              </FadeUp>
            )}
          </>
        )}
      </div>

      {/* ── Streak tracker + daily word goal ───────────────────────── */}
      <StreakTracker
        activeDates={activeDates}
        streakDays={streakDays}
        streakState={streakState}
      />

      {/* Daily word goal */}
      <FadeUp delay={0.1}>
        <div className="border border-border/50 rounded-xl px-5 py-4">
          <WordGoal wordsWrittenToday={wordsWrittenToday} />
        </div>
      </FadeUp>

      {/* ── Horizon ─────────────────────────────────────────────────── */}
      <FadeUp delay={0.15}>
        <HorizonPanel initialItems={horizonItems} />
      </FadeUp>

      {/* ── From your journal ──────────────────────────────────────── */}
      {pastEntry && (
        <FadeUp delay={0.17}>
          <Link
            href={`/app/interview/${pastEntry.domain}`}
            className="group block border border-border/60 rounded-xl px-5 py-4 space-y-2.5 hover:border-foreground/15 hover:bg-surface/30 transition-all"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-label">From your journal</p>
              <span className="text-[10px] text-muted-foreground/50 shrink-0">
                {new Date(pastEntry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <p className="text-sm text-foreground/70 leading-relaxed line-clamp-3 font-light">
              {pastEntry.content}
            </p>
            <p className="text-[10px] text-muted-foreground/40 group-hover:text-muted-foreground transition-colors capitalize">
              {pastEntry.domain} · Revisit →
            </p>
          </Link>
        </FadeUp>
      )}

      {/* ── On this day ───────────────────────────────────────────── */}
      <OnThisDay entries={onThisDayEntries} />

      {/* ── Soul Profile ─────────────────────────────────────────────── */}
      <FadeUp delay={0.18}>
        <div className="space-y-6">
          {/* Section header */}
          <div className="flex items-center gap-3">
            <p className="text-label shrink-0">Soul profile</p>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Stats + ring */}
          <div className="flex items-center gap-8">
            <SoulRing countByDomain={countByDomain} />

            <div className="space-y-3 flex-1">
              <div>
                <p className="text-[1.5rem] font-light tracking-[-0.025em] text-foreground leading-none">
                  {totalEntries === 0 ? 'Begin.' : totalEntries.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {totalEntries === 0 ? 'No memories captured yet.' : `${totalEntries === 1 ? 'memory' : 'memories'} · ${totalWords.toLocaleString()} words`}
                </p>
              </div>

              {totalEntries > 0 && (
                <div className="space-y-1.5">
                  <div className="h-px bg-border overflow-hidden rounded-full">
                    <div
                      className="h-full bg-foreground/40 rounded-full"
                      style={{
                        width: `${(filledDomains / DOMAINS.length) * 100}%`,
                        transition: 'width 0.8s cubic-bezier(0.25, 0.1, 0.25, 1)',
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {filledDomains} of {DOMAINS.length} domains explored
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Domain grid */}
          <Stagger className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {DOMAINS.map(({ domain, label }) => {
              const count = countByDomain[domain] ?? 0
              const isFilled = count > 0
              return (
                <StaggerItem key={domain}>
                  <Link
                    href={`/app/interview/${domain}`}
                    className="group block border border-border rounded-xl p-4 hover:border-foreground/20 hover:bg-surface transition-all duration-200"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-opacity ${DOMAIN_DOT[domain]} ${isFilled ? 'opacity-100' : 'opacity-25'}`} />
                      <p className="text-sm text-foreground">{label}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {count === 0 ? 'Begin →' : `${count} saved`}
                    </p>
                  </Link>
                </StaggerItem>
              )
            })}
          </Stagger>

          {/* Milestones */}
          <Milestones
            totalEntries={totalEntries}
            totalWords={totalWords}
            domainsExplored={filledDomains}
            heirCount={heirCount}
            streakDays={streakDays}
          />
        </div>
      </FadeUp>

      {/* ── Recently captured ──────────────────────────────────────── */}
      {entries.length > 0 && (
        <FadeUp delay={0.22}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="text-label shrink-0">Recently captured</p>
                <div className="flex-1 h-px bg-border" />
              </div>
              <Link href="/app/review" className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-4 shrink-0">
                See all →
              </Link>
            </div>
            <div className="space-y-2">
              {entries.slice(0, 3).map((entry) => {
                const ago = (() => {
                  const ms = Date.now() - new Date(entry.created_at).getTime()
                  const mins = Math.floor(ms / 60_000)
                  const hrs  = Math.floor(ms / 3_600_000)
                  const days = Math.floor(ms / 86_400_000)
                  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`
                  if (hrs  < 24) return `${hrs}h ago`
                  if (days < 7)  return `${days}d ago`
                  return new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                })()
                const snippet = entry.content.replace(/\n+/g, ' ').slice(0, 120)
                const label = entry.domain.charAt(0).toUpperCase() + entry.domain.slice(1)
                return (
                  <Link
                    key={entry.id}
                    href={`/app/interview/${entry.domain}`}
                    className="group flex items-start gap-3 rounded-xl border border-border px-4 py-3 hover:border-foreground/20 hover:bg-surface transition-all"
                  >
                    <span className="mt-0.5 text-[9px] uppercase tracking-widest text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0 group-hover:border-foreground/20 transition-colors">
                      {label}
                    </span>
                    <p className="text-sm text-muted-foreground leading-relaxed flex-1 truncate">
                      {snippet}{entry.content.length > 120 ? '…' : ''}
                    </p>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0 mt-0.5">{ago}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </FadeUp>
      )}

      {/* ── Quick links ──────────────────────────────────────────────── */}
      <FadeUp delay={0.25}>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground border-t border-border pt-8">
          <Link href="/app/memoir"         className="hover:text-foreground transition-colors">Your memoir</Link>
          <Link href="/app/memoir/people"  className="hover:text-foreground transition-colors">People in your story</Link>
          <Link href="/app/review"         className="hover:text-foreground transition-colors">Review entries</Link>
          <Link href="/app/archive"        className="hover:text-foreground transition-colors">Archive</Link>
          <Link href="/app/interview/chat" className="hover:text-foreground transition-colors">AI memoir chat</Link>
          <Link href="/app/search"         className="hover:text-foreground transition-colors">Search</Link>
          <Link href="/app/lifemap"        className="hover:text-foreground transition-colors">Life map</Link>
          <Link href="/app/values"         className="hover:text-foreground transition-colors">Values</Link>
          <Link href="/app/letters"        className="hover:text-foreground transition-colors">Final letters</Link>
          <Link href="/app/settings"       className="hover:text-foreground transition-colors">Heirs & executors</Link>
          <Link href="/app/export"         className="hover:text-foreground transition-colors">Export data</Link>
          <Link href="/app/profile"        className="hover:text-foreground transition-colors">Profile</Link>
        </div>
      </FadeUp>
    </div>
  )
}
