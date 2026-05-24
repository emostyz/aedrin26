import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { FadeUp, Stagger, StaggerItem } from '@/components/ui/motion'
import { ReflectionPrompt } from '@/components/dashboard/reflection-prompt'
import type { Domain } from '@/lib/supabase/types'

const DOMAINS: { domain: Domain; label: string }[] = [
  { domain: 'childhood', label: 'Childhood' },
  { domain: 'family',    label: 'Family' },
  { domain: 'career',    label: 'Career' },
  { domain: 'values',    label: 'Values' },
  { domain: 'beliefs',   label: 'Beliefs' },
  { domain: 'lessons',   label: 'Lessons' },
  { domain: 'messages',  label: 'Messages' },
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceClient()

  const [entriesResult, profileResult, legacyResult, promptsResult] = await Promise.all([
    supabase.from('soul_entries').select('id, domain').eq('user_id', user.id),
    supabase.from('users').select('account_state, legal_name').eq('id', user.id).single(),
    service.from('heirs').select('id, user_id').eq('email', user.email!.toLowerCase()).eq('access_status', 'active'),
    supabase.from('interview_prompts').select('id, domain, text').eq('active', true).limit(20),
  ])

  const entries = (entriesResult.data ?? []) as { id: string; domain: Domain }[]
  const profile = profileResult.data as { account_state: string; legal_name: string } | null
  const legacyHeirs = (legacyResult.data ?? []) as { id: string; user_id: string }[]
  const allPrompts = (promptsResult.data ?? []) as { id: string; domain: string; text: string }[]

  // Surfaces prompts from domains with fewest entries (most room for reflection)
  const countByDomainMap = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.domain] = (acc[e.domain] ?? 0) + 1
    return acc
  }, {})
  const reflectionPrompts = allPrompts
    .filter((p) => (countByDomainMap[p.domain] ?? 0) < 3)
    .sort(() => Math.random() - 0.5)
    .slice(0, 5)

  const countByDomain = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.domain] = (acc[e.domain] ?? 0) + 1
    return acc
  }, {})

  const totalEntries = entries.length

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

  return (
    <div className="space-y-16">
      {/* Legacy access */}
      {legacyAccess.length > 0 && (
        <FadeUp>
          <div className="border border-border rounded-lg p-5 space-y-4">
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
          <div className="border border-destructive/20 rounded-lg p-5">
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

      {/* Reflection prompt */}
      {reflectionPrompts.length > 0 && (
        <FadeUp delay={0.05}>
          <ReflectionPrompt prompts={reflectionPrompts} />
        </FadeUp>
      )}

      {/* Soul Profile header */}
      <FadeUp>
        <div className="space-y-1">
          <p className="text-label">Soul Profile</p>
          <p className="text-[2rem] font-light tracking-[-0.03em] text-foreground leading-tight">
            {totalEntries === 0
              ? 'Begin capturing your life.'
              : `${totalEntries} ${totalEntries === 1 ? 'entry' : 'entries'}.`}
          </p>
        </div>
      </FadeUp>

      {/* Domain grid */}
      <Stagger className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {DOMAINS.map(({ domain, label }) => {
          const count = countByDomain[domain] ?? 0
          return (
            <StaggerItem key={domain}>
              <Link
                href={`/app/interview/${domain}`}
                className="group block border border-border rounded-lg p-4 hover:border-foreground/20 hover:bg-surface transition-all duration-200"
              >
                <p className="text-sm text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {count === 0 ? '—' : count}
                </p>
              </Link>
            </StaggerItem>
          )
        })}
      </Stagger>

      {/* Quick links */}
      <FadeUp delay={0.3}>
        <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
          <Link href="/app/review" className="hover:text-foreground transition-colors">Review entries</Link>
          <Link href="/app/lifemap" className="hover:text-foreground transition-colors">Life map</Link>
          <Link href="/app/values" className="hover:text-foreground transition-colors">Values</Link>
          <Link href="/app/settings" className="hover:text-foreground transition-colors">Heirs & executors</Link>
          <Link href="/app/export" className="hover:text-foreground transition-colors">Export data</Link>
        </div>
      </FadeUp>
    </div>
  )
}
