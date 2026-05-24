import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FadeUp, Stagger, StaggerItem } from '@/components/ui/motion'
import type { Domain } from '@/lib/supabase/types'

const DOMAINS: { domain: Domain; label: string; description: string }[] = [
  { domain: 'childhood', label: 'Childhood',  description: 'Where you came from.' },
  { domain: 'family',    label: 'Family',     description: 'The people who shaped you.' },
  { domain: 'career',    label: 'Career',     description: 'What you built and learned.' },
  { domain: 'values',    label: 'Values',     description: 'What you believe and why.' },
  { domain: 'beliefs',   label: 'Beliefs',    description: 'How you understand the world.' },
  { domain: 'lessons',   label: 'Lessons',    description: 'What you would pass on.' },
  { domain: 'messages',  label: 'Messages',   description: 'Things you want said.' },
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

  return (
    <div className="space-y-12">
      <FadeUp className="space-y-2">
        <p className="text-label">Capture</p>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          Choose a domain.
        </p>
        <p className="text-sm text-muted-foreground">
          Take your time. There are no right answers.
        </p>
      </FadeUp>

      <Stagger className="space-y-1">
        {DOMAINS.map(({ domain, label, description }) => {
          const count = countByDomain[domain] ?? 0
          return (
            <StaggerItem key={domain}>
              <Link
                href={`/app/interview/${domain}`}
                className="group flex items-center justify-between border border-border rounded-lg px-5 py-4 hover:border-foreground/20 hover:bg-surface transition-all duration-200"
              >
                <div className="space-y-0.5">
                  <p className="text-sm text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <p className="text-xs text-muted-foreground shrink-0 ml-6">
                  {count === 0 ? '—' : count}
                </p>
              </Link>
            </StaggerItem>
          )
        })}
      </Stagger>
    </div>
  )
}
