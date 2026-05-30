import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FadeUp, Stagger, StaggerItem } from '@/components/ui/motion'
import { CaptureOptions } from '@/components/interview/capture-options'
import type { Domain } from '@/lib/supabase/types'

interface DomainMeta {
  domain: Domain
  label: string
  description: string
  dot: string        // Tailwind colour for the dot
  accent: string     // Tailwind for left-border accent on hover
}

const DOMAINS: DomainMeta[] = [
  { domain: 'childhood', label: 'Childhood',  description: 'Where you came from.',            dot: 'bg-amber-400',   accent: 'hover:border-l-amber-500/60'   },
  { domain: 'family',    label: 'Family',     description: 'The people who shaped you.',      dot: 'bg-rose-400',    accent: 'hover:border-l-rose-500/60'    },
  { domain: 'career',    label: 'Career',     description: 'What you built and learned.',     dot: 'bg-blue-400',    accent: 'hover:border-l-blue-500/60'    },
  { domain: 'values',    label: 'Values',     description: 'What you believe and why.',       dot: 'bg-emerald-400', accent: 'hover:border-l-emerald-500/60' },
  { domain: 'beliefs',   label: 'Beliefs',    description: 'How you understand the world.',   dot: 'bg-violet-400',  accent: 'hover:border-l-violet-500/60'  },
  { domain: 'lessons',   label: 'Lessons',    description: 'What you would pass on.',         dot: 'bg-orange-400',  accent: 'hover:border-l-orange-500/60'  },
  { domain: 'messages',  label: 'Messages',   description: 'Things you want said.',           dot: 'bg-teal-400',    accent: 'hover:border-l-teal-500/60'    },
]

export default async function InterviewIndexPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('soul_entries')
    .select('id, domain, created_at')
    .eq('user_id', user.id)
    .is('bound_recipient_id', null)

  const entries = (data ?? []) as { id: string; domain: Domain; created_at: string }[]

  const countByDomain = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.domain] = (acc[e.domain] ?? 0) + 1
    return acc
  }, {})

  // Most-recent entry date per domain
  const lastByDomain = entries.reduce<Record<string, string>>((acc, e) => {
    if (!acc[e.domain] || e.created_at > acc[e.domain]) acc[e.domain] = e.created_at
    return acc
  }, {})

  function relativeDate(iso: string): string {
    const ms   = Date.now() - new Date(iso).getTime()
    const days = Math.floor(ms / 86_400_000)
    if (days === 0) return 'today'
    if (days === 1) return 'yesterday'
    if (days < 7)  return `${days} days ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    if (days < 365) return `${Math.floor(days / 30)}mo ago`
    return `${Math.floor(days / 365)}y ago`
  }

  const totalEntries = entries.length
  const filledDomains = DOMAINS.filter((d) => countByDomain[d.domain] > 0).length

  // Suggest the first untouched domain, or the one with the fewest entries
  const suggestedDomain = (() => {
    const untouched = DOMAINS.find((d) => !countByDomain[d.domain])
    if (untouched) return untouched.domain
    // All touched — suggest the one with fewest entries
    return DOMAINS.slice().sort((a, b) => (countByDomain[a.domain] ?? 0) - (countByDomain[b.domain] ?? 0))[0]?.domain ?? null
  })()

  return (
    <div className="space-y-12">
      <FadeUp className="space-y-3">
        <p className="text-label">Capture</p>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          Choose a domain.
        </p>
        <p className="text-sm text-muted-foreground">
          For past memories — your history, the people who shaped you, the things you&apos;ve learned.
          Writing about today?{' '}
          <Link href="/app/today" className="text-foreground underline underline-offset-4 hover:opacity-80 transition-opacity">
            Use Today&apos;s journal →
          </Link>
        </p>

        {/* Completion summary */}
        {totalEntries > 0 && (
          <div className="pt-1 space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border overflow-hidden rounded-full">
                <div
                  className="h-full bg-foreground/40 rounded-full transition-all duration-700"
                  style={{ width: `${(filledDomains / DOMAINS.length) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground shrink-0">
                {filledDomains} / {DOMAINS.length} explored
              </p>
            </div>
            {suggestedDomain && (
              <p className="text-[11px] text-muted-foreground">
                Suggested next:{' '}
                <Link href={`/app/interview/${suggestedDomain}`} className="text-foreground hover:underline underline-offset-2">
                  {DOMAINS.find((d) => d.domain === suggestedDomain)?.label}
                </Link>
              </p>
            )}
          </div>
        )}
      </FadeUp>

      {/* Life Review — featured mode */}
      <FadeUp delay={0.04}>
        <Link
          href="/app/interview/life-review"
          className="group block border border-border rounded-xl px-6 py-5 hover:border-foreground/20 hover:bg-surface/30 transition-all duration-200 space-y-2"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <p className="text-label text-muted-foreground">Featured</p>
              <p className="text-sm text-foreground font-light leading-snug">Life Review</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                A structured journey through every decade — childhood to reflection.
                Six chapters, five questions each, designed to document your whole story.
              </p>
            </div>
            <p className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground shrink-0 transition-colors pt-5">
              Begin →
            </p>
          </div>
        </Link>
      </FadeUp>

      {/* Capture mode options */}
      <FadeUp delay={0.05}>
        <div className="space-y-2">
          {/* Deep memory capture */}
          <CaptureOptions defaultDomain={suggestedDomain ?? 'childhood'} />

          {/* AI chat */}
          <Link
          href="/app/interview/chat"
          className="group flex items-center justify-between border border-dashed border-border rounded-lg px-5 py-4 hover:border-foreground/20 hover:bg-surface/30 transition-all duration-200"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-foreground/20 group-hover:bg-foreground/40 transition-colors" />
            <div>
              <p className="text-sm text-foreground">Not sure where to start?</p>
              <p className="text-xs text-muted-foreground mt-0.5">Chat with AI — answer questions and save them as memories</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground shrink-0 ml-6 transition-colors">
            Start chatting →
          </p>
        </Link>
        </div>
      </FadeUp>

      <Stagger className="space-y-1.5">
        {DOMAINS.map(({ domain, label, description, dot, accent }) => {
          const count = countByDomain[domain] ?? 0
          const isFilled = count > 0

          return (
            <StaggerItem key={domain}>
              <Link
                href={`/app/interview/${domain}`}
                className={`group flex items-center justify-between border border-l-2 border-border rounded-lg px-5 py-4 hover:border-foreground/15 hover:bg-surface transition-all duration-200 ${accent}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Domain colour dot */}
                  <span className={`shrink-0 w-1.5 h-1.5 rounded-full transition-opacity ${dot} ${isFilled ? 'opacity-100' : 'opacity-30'}`} />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-0.5 shrink-0 ml-6">
                  {isFilled ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {count} {count === 1 ? 'entry' : 'entries'}
                      </p>
                      {lastByDomain[domain] && (
                        <p className="text-[10px] text-muted-foreground/50">
                          {relativeDate(lastByDomain[domain])}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground/40">Begin →</p>
                  )}
                </div>
              </Link>
            </StaggerItem>
          )
        })}
      </Stagger>
    </div>
  )
}
