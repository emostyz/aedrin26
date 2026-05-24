import { createClient } from '@/lib/supabase/server'
import { EntryCard } from '@/components/review/entry-card'
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

export default async function ReviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('soul_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="rounded-lg border border-border px-5 py-8 text-center">
        <p className="text-sm text-destructive">Failed to load entries. Please try again.</p>
      </div>
    )
  }

  const entries = (data ?? []) as SoulEntry[]

  const byDomain = entries.reduce<Record<string, SoulEntry[]>>((acc, e) => {
    if (!acc[e.domain]) acc[e.domain] = []
    acc[e.domain]!.push(e)
    return acc
  }, {})

  const domains = Object.keys(byDomain) as Domain[]

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Review</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          All captured entries. Toggle sharing status to control what heirs may access.
          Default is <strong className="font-medium text-foreground">private</strong> — sharing is opt-in.
        </p>
      </div>

      {domains.length === 0 ? (
        <div className="rounded-lg border border-border px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing captured yet.{' '}
            <a href="/app/interview" className="underline underline-offset-4 hover:text-foreground">
              Start an interview
            </a>
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {domains.map((domain) => (
            <section key={domain} className="space-y-3">
              <h3 className="text-sm font-medium text-foreground uppercase tracking-widest">
                {DOMAIN_LABELS[domain] ?? domain}
              </h3>
              <ul className="space-y-2">
                {byDomain[domain]!.map((entry) => (
                  <li key={entry.id}>
                    <EntryCard entry={entry} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
