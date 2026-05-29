import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FadeUp, Stagger, StaggerItem } from '@/components/ui/motion'
import type { Domain } from '@/lib/supabase/types'

const DOMAIN_LABELS: Record<Domain, string> = {
  childhood: 'Childhood', family: 'Family', career: 'Career',
  values: 'Values', beliefs: 'Beliefs', lessons: 'Lessons',
  messages: 'Messages', other: 'Other',
}

const DOMAIN_ACCENT: Record<Domain, string> = {
  childhood: 'border-l-amber-500/40',
  family:    'border-l-rose-500/40',
  career:    'border-l-blue-500/40',
  values:    'border-l-emerald-500/40',
  beliefs:   'border-l-violet-500/40',
  lessons:   'border-l-orange-500/40',
  messages:  'border-l-teal-500/40',
  other:     'border-l-border',
}

type Props = { params: Promise<{ heirId: string }> }

export default async function HeirPreviewPage({ params }: Props) {
  const { heirId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Verify the heir belongs to this user
  const { data: heir } = await supabase
    .from('heirs')
    .select('id, name, relationship, email')
    .eq('id', heirId)
    .eq('user_id', user.id)
    .single()

  if (!heir) notFound()

  const heirRow = heir as { id: string; name: string; relationship: string; email: string }

  // Fetch this heir's allowed domains
  const { data: permsData } = await supabase
    .from('heir_permissions')
    .select('domain, allowed')
    .eq('heir_id', heirId)

  const perms = (permsData ?? []) as { domain: string; allowed: boolean }[]
  const allowedDomains = perms
    .filter((p) => p.allowed)
    .map((p) => p.domain as Domain)

  // Fetch shareable entries in allowed domains (what this heir would see)
  const { data: entriesData } = await supabase
    .from('soul_entries')
    .select('id, domain, content, created_at')
    .eq('user_id', user.id)
    .eq('sharing_status', 'shareable')
    .is('bound_recipient_id', null)          // exclude private final letters
    .in('domain', allowedDomains.length ? allowedDomains : ['__none__'])
    .order('created_at', { ascending: false })

  const entries = (entriesData ?? []) as { id: string; domain: Domain; content: string; created_at: string }[]

  // Fetch final letters addressed specifically to this heir
  const { data: lettersData } = await supabase
    .from('soul_entries')
    .select('id, content, created_at')
    .eq('user_id', user.id)
    .eq('bound_recipient_id', heirId)
    .order('created_at', { ascending: false })

  const letters = (lettersData ?? []) as { id: string; content: string; created_at: string }[]

  // Group entries by domain
  const byDomain = allowedDomains.reduce<Record<Domain, typeof entries>>((acc, d) => {
    acc[d] = entries.filter((e) => e.domain === d)
    return acc
  }, {} as Record<Domain, typeof entries>)

  const totalShared = entries.length + letters.length

  return (
    <div className="space-y-12">
      {/* Header */}
      <FadeUp className="space-y-3">
        <Link
          href="/app/settings"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Settings
        </Link>
        <p className="text-label">Preview as heir</p>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          What {heirRow.name} would see.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
          A read-only preview of your legacy as it would appear to{' '}
          <strong className="text-foreground font-normal">{heirRow.name}</strong> ({heirRow.relationship}).
          Only entries marked &quot;For heirs&quot; in their permitted domains are included.
          Final letters are shown separately.
        </p>
      </FadeUp>

      {/* Access scope */}
      <FadeUp delay={0.05}>
        <div className="rounded-xl border border-border/60 bg-surface/20 px-5 py-4 space-y-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Access scope</p>
          <div className="flex flex-wrap gap-2">
            {allowedDomains.length > 0 ? (
              allowedDomains.map((d) => (
                <span
                  key={d}
                  className="text-xs px-3 py-1 rounded-full border border-foreground/20 text-foreground bg-foreground/5"
                >
                  {DOMAIN_LABELS[d]}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">No domains granted — add permissions in Settings.</span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {totalShared} {totalShared === 1 ? 'item' : 'items'} visible to {heirRow.name}
            {totalShared === 0 ? ' — mark entries "For heirs" to include them.' : '.'}
          </p>
        </div>
      </FadeUp>

      {/* Empty state */}
      {totalShared === 0 && (
        <FadeUp delay={0.1}>
          <div className="rounded-xl border border-border px-5 py-12 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Nothing is visible to {heirRow.name} yet.
            </p>
            <p className="text-xs text-muted-foreground">
              Go to{' '}
              <Link href="/app/review" className="text-foreground underline underline-offset-2">
                Review
              </Link>{' '}
              and mark entries &quot;For heirs,&quot; then check that{' '}
              <Link href="/app/settings" className="text-foreground underline underline-offset-2">
                their domain permissions
              </Link>{' '}
              include those topics.
            </p>
          </div>
        </FadeUp>
      )}

      {/* Entries by domain */}
      {allowedDomains.map((domain) => {
        const domainEntries = byDomain[domain] ?? []
        if (domainEntries.length === 0) return null
        return (
          <FadeUp key={domain} delay={0.08}>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <p className="text-label shrink-0">{DOMAIN_LABELS[domain]}</p>
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {domainEntries.length} {domainEntries.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>
              <Stagger className="space-y-2">
                {domainEntries.map((entry) => (
                  <StaggerItem key={entry.id}>
                    <div
                      className={`border border-l-2 border-border rounded-lg px-5 py-4 space-y-2 bg-surface/10 ${DOMAIN_ACCENT[domain]}`}
                    >
                      <p className="text-sm text-foreground leading-relaxed font-light">
                        {entry.content}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">
                        {new Date(entry.created_at).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'long', day: 'numeric',
                        })}
                      </p>
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          </FadeUp>
        )
      })}

      {/* Final letters */}
      {letters.length > 0 && (
        <FadeUp delay={0.1}>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <p className="text-label shrink-0">Final letters</p>
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground shrink-0">
                Delivered privately after death · Not shown to the heir now
              </span>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface/20 px-5 py-4 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {letters.length} letter{letters.length !== 1 ? 's' : ''} addressed specifically to {heirRow.name}.
                These are sealed — they will be sent by email to {heirRow.email} only after your account is memorialized.
                They are not part of the shared memory archive above.
              </p>
              <Link href="/app/letters" className="text-xs text-foreground hover:underline underline-offset-2">
                Edit letters →
              </Link>
            </div>
          </div>
        </FadeUp>
      )}

      {/* Bottom note */}
      <FadeUp delay={0.15}>
        <div className="border-t border-border pt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Link href="/app/review" className="hover:text-foreground transition-colors">
            Mark more entries for heirs →
          </Link>
          <Link href="/app/settings" className="hover:text-foreground transition-colors">
            Edit heir permissions →
          </Link>
          <Link href="/app/letters" className="hover:text-foreground transition-colors">
            Write a final letter →
          </Link>
        </div>
      </FadeUp>
    </div>
  )
}
