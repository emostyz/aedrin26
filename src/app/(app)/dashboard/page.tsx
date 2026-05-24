import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Domain } from '@/lib/supabase/types'

const DOMAINS: Domain[] = ['childhood', 'family', 'career', 'values', 'beliefs', 'lessons', 'messages']

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

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: entries } = await supabase
    .from('soul_entries')
    .select('id, domain')
    .eq('user_id', user.id) as { data: { id: string; domain: Domain }[] | null }

  const entryCountByDomain = (entries ?? []).reduce<Record<string, number>>((acc, e) => {
    acc[e.domain] = (acc[e.domain] ?? 0) + 1
    return acc
  }, {})

  const totalEntries = entries?.length ?? 0

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Your Soul Profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalEntries === 0
            ? 'You haven\'t captured anything yet. Start with any domain below.'
            : `${totalEntries} ${totalEntries === 1 ? 'entry' : 'entries'} captured across your life.`}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {DOMAINS.map((domain) => {
          const count = entryCountByDomain[domain] ?? 0
          return (
            <Link
              key={domain}
              href={`/app/interview/${domain}`}
              className="group rounded-lg border border-border p-4 hover:border-foreground/30 transition-colors"
            >
              <p className="text-sm font-medium text-foreground">{DOMAIN_LABELS[domain]}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {count === 0 ? 'Not started' : `${count} ${count === 1 ? 'entry' : 'entries'}`}
              </p>
            </Link>
          )
        })}
      </div>

      <div className="flex gap-4 text-sm">
        <Link href="/app/review" className="underline underline-offset-4 text-muted-foreground hover:text-foreground">
          Review all entries
        </Link>
        <Link href="/app/lifemap" className="underline underline-offset-4 text-muted-foreground hover:text-foreground">
          Your life map
        </Link>
      </div>
    </div>
  )
}
