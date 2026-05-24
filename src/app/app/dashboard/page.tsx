import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { FadeUp, Stagger, StaggerItem } from '@/components/ui/motion'
import { TodayPrompt } from '@/components/dashboard/today-prompt'
import { DailyInsight } from '@/components/dashboard/daily-insight'
import { HorizonPanel } from '@/components/dashboard/horizon-panel'
import { getOrCreateTodaysPrompt } from '@/app/actions/daily-prompt'
import { getOrCreateTodaysInsight } from '@/app/actions/daily-insight'
import { getHorizonItems } from '@/app/actions/horizon'
import type { Domain } from '@/lib/supabase/types'
import { StreakTracker, type StreakState } from '@/components/dashboard/streak-tracker'

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

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceClient()

  // Run all data fetches in parallel, including AI generation for today's prompt + insight
  const [entriesResult, profileResult, legacyResult, todayPromptResult, todayInsightResult, horizonItems, recentEntriesResult] = await Promise.all([
    supabase.from('soul_entries').select('id, domain, content, daily_prompt_id').eq('user_id', user.id),
    supabase.from('users').select('account_state, legal_name, display_name').eq('id', user.id).single(),
    service.from('heirs').select('id, user_id').eq('email', user.email!.toLowerCase()).eq('access_status', 'active'),
    getOrCreateTodaysPrompt(),
    getOrCreateTodaysInsight(),
    getHorizonItems(),
    supabase.from('soul_entries')
      .select('created_at')
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString())
      .order('created_at', { ascending: false }),
  ])

  const entries = (entriesResult.data ?? []) as { id: string; domain: Domain; content: string; daily_prompt_id: string | null }[]
  const profile = profileResult.data as { account_state: string; legal_name: string; display_name: string | null } | null
  const legacyHeirs = (legacyResult.data ?? []) as { id: string; user_id: string }[]
  const todayPrompt = todayPromptResult.prompt
  const todayInsight = todayInsightResult.insight

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

      {/* ── Greeting + daily prompt ─────────────────────────────────── */}
      <div className="space-y-6">
        <FadeUp>
          <div className="space-y-1">
            <p className="text-label">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
              {firstName ? `Good to see you, ${firstName}.` : 'Good to see you.'}
            </p>
          </div>
        </FadeUp>

        <FadeUp delay={0.05}>
          {todayPrompt ? (
            <TodayPrompt
              promptId={todayPrompt.id}
              promptText={todayPrompt.prompt_text}
              domain={todayPrompt.domain}
              existingEntry={todayAnsweredEntry ? { content: todayAnsweredEntry.content } : null}
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

        {todayInsight && (
          <FadeUp delay={0.12}>
            <DailyInsight
              insightText={todayInsight.insight_text}
              recommendation={todayInsight.recommendation}
              patternSources={todayInsight.pattern_sources}
            />
          </FadeUp>
        )}
      </div>

      {/* ── Streak tracker ──────────────────────────────────────────── */}
      <StreakTracker
        activeDates={activeDates}
        streakDays={streakDays}
        streakState={streakState}
      />

      {/* ── Horizon ─────────────────────────────────────────────────── */}
      <FadeUp delay={0.15}>
        <HorizonPanel initialItems={horizonItems} />
      </FadeUp>

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
        </div>
      </FadeUp>

      {/* ── Quick links ──────────────────────────────────────────────── */}
      <FadeUp delay={0.25}>
        <div className="flex flex-wrap gap-6 text-xs text-muted-foreground border-t border-border pt-8">
          <Link href="/app/review"  className="hover:text-foreground transition-colors">Review entries</Link>
          <Link href="/app/lifemap" className="hover:text-foreground transition-colors">Life map</Link>
          <Link href="/app/values"  className="hover:text-foreground transition-colors">Values</Link>
          <Link href="/app/settings" className="hover:text-foreground transition-colors">Heirs & executors</Link>
          <Link href="/app/export"  className="hover:text-foreground transition-colors">Export data</Link>
          <Link href="/app/profile" className="hover:text-foreground transition-colors">Profile</Link>
        </div>
      </FadeUp>
    </div>
  )
}
