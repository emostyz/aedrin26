import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Domain } from '@/lib/supabase/types'

const DOMAINS: { domain: Domain; label: string; description: string }[] = [
  { domain: 'childhood', label: 'Childhood', description: 'Early memories, home, the adults who shaped you.' },
  { domain: 'family', label: 'Family', description: 'Parents, siblings, traditions, things unsaid.' },
  { domain: 'career', label: 'Career', description: 'Work you\'re proud of, failure, hard-won lessons.' },
  { domain: 'values', label: 'Values', description: 'What you believe, what you\'ve changed your mind about.' },
  { domain: 'beliefs', label: 'Beliefs', description: 'Mortality, faith, how to treat people.' },
  { domain: 'lessons', label: 'Lessons', description: 'What you\'d most want passed on.' },
  { domain: 'messages', label: 'Messages', description: 'Things you want to say to specific people.' },
]

export default async function InterviewIndexPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: entries } = await supabase
    .from('soul_entries')
    .select('id, domain')
    .eq('user_id', user.id) as { data: { id: string; domain: Domain }[] | null }

  const countByDomain = (entries ?? []).reduce<Record<string, number>>((acc, e) => {
    acc[e.domain] = (acc[e.domain] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Capture</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a domain to begin. Take your time — there are no right answers.
        </p>
      </div>

      <ul className="space-y-2">
        {DOMAINS.map(({ domain, label, description }) => {
          const count = countByDomain[domain] ?? 0
          return (
            <li key={domain}>
              <Link
                href={`/app/interview/${domain}`}
                className="flex items-center justify-between rounded-lg border border-border px-5 py-4 hover:border-foreground/30 transition-colors group"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </div>
                <span className="text-xs text-muted-foreground ml-4 shrink-0">
                  {count === 0 ? 'Start' : `${count} saved`}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
