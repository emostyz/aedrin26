import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FadeUp, Stagger, StaggerItem } from '@/components/ui/motion'
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

  const { data } = await supabase.from('soul_entries').select('id, domain').eq('user_id', user.id)
  const countByDomain = ((data ?? []) as { id: string; domain: Domain }[])
    .reduce<Record<string, number>>((acc, e) => {
      acc[e.domain] = (acc[e.domain] ?? 0) + 1
      return acc
    }, {})

  const totalEntries = (data ?? []).length
  const filledDomains = DOMAINS.filter((d) => countByDomain[d.domain] > 0).length

  return (
    <div className="space-y-12">
      <FadeUp className="space-y-3">
        <p className="text-label">Capture</p>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          Choose a domain.
        </p>
        <p className="text-sm text-muted-foreground">
          Take your time. There are no right answers.
        </p>

        {/* Completion summary */}
        {totalEntries > 0 && (
          <div className="pt-1 flex items-center gap-3">
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
        )}
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

                <div className="flex items-center gap-3 shrink-0 ml-6">
                  {isFilled ? (
                    <p className="text-xs text-muted-foreground">
                      {count} {count === 1 ? 'entry' : 'entries'}
                    </p>
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
