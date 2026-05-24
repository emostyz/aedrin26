import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { Domain } from '@/lib/supabase/types'

const DOMAINS: Domain[] = ['childhood', 'family', 'career', 'values', 'beliefs', 'lessons', 'messages']

const DOMAIN_LABELS: Record<Domain, string> = {
  childhood: 'Childhood', family: 'Family', career: 'Career',
  values: 'Values', beliefs: 'Beliefs', lessons: 'Lessons',
  messages: 'Messages', other: 'Other',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceClient()

  const [entriesResult, profileResult, legacyAccessResult] = await Promise.all([
    supabase.from('soul_entries').select('id, domain').eq('user_id', user.id),
    supabase.from('users').select('account_state').eq('id', user.id).single(),
    service.from('heirs').select('id, user_id, name')
      .eq('email', user.email!.toLowerCase()).eq('access_status', 'active'),
  ])

  const entries = (entriesResult.data ?? []) as { id: string; domain: Domain }[]
  const profile = profileResult.data as { account_state: string } | null

  const entryCountByDomain = (entries ?? []).reduce<Record<string, number>>((acc, e) => {
    acc[e.domain] = (acc[e.domain] ?? 0) + 1
    return acc
  }, {})

  const totalEntries = entries?.length ?? 0
  const accountState = profile?.account_state ?? 'active'

  // Filter to only legacy_active accounts
  const legacyAccess = (legacyAccessResult.data ?? []) as { id: string; user_id: string; name: string }[]
  const legacyActiveHeirs: { userId: string; deceasedName: string }[] = []
  for (const h of legacyAccess) {
    const { data: deceasedUser } = await service
      .from('users')
      .select('id, legal_name, display_name, account_state')
      .eq('id', h.user_id)
      .eq('account_state', 'legacy_active')
      .single() as { data: { id: string; legal_name: string; display_name: string | null; account_state: string } | null }
    if (deceasedUser) {
      legacyActiveHeirs.push({
        userId: deceasedUser.id,
        deceasedName: deceasedUser.display_name ?? deceasedUser.legal_name,
      })
    }
  }

  return (
    <div className="space-y-10">
      {/* Legacy access banner — shown to heirs of legacy_active accounts */}
      {legacyActiveHeirs.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/50 px-5 py-4 space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Legacy access</p>
          {legacyActiveHeirs.map((h) => (
            <div key={h.userId} className="flex items-center justify-between">
              <p className="text-sm text-foreground">{h.deceasedName}</p>
              <Link
                href={`/app/legacy/${h.userId}`}
                className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground"
              >
                Open →
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Memorialization warning banner */}
      {accountState === 'memorializing' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-5 py-4">
          <p className="text-sm font-medium text-foreground">A memorialization request is active for your account.</p>
          <p className="text-xs text-muted-foreground mt-1">
            If this was initiated in error, you can cancel it during the grace period.{' '}
            <Link href="/app/settings/memorialization" className="underline underline-offset-4 hover:text-foreground">
              View status →
            </Link>
          </p>
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold text-foreground">Your Soul Profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalEntries === 0
            ? "You haven't captured anything yet. Start with any domain below."
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

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/app/review" className="underline underline-offset-4 text-muted-foreground hover:text-foreground">
          Review all entries
        </Link>
        <Link href="/app/lifemap" className="underline underline-offset-4 text-muted-foreground hover:text-foreground">
          Your life map
        </Link>
        <Link href="/app/settings" className="underline underline-offset-4 text-muted-foreground hover:text-foreground">
          Heirs & executors
        </Link>
      </div>
    </div>
  )
}
