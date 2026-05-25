import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FadeUp } from '@/components/ui/motion'

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Draft — not yet submitted',
  docs_submitted: 'Documents added — not yet submitted',
  pending_review: 'Under review',
  approved: 'Approved — access granted',
  rejected: 'Declined',
  cancelled: 'Cancelled',
  expired: 'Expired',
}

export default async function RepresentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('access_requests')
    .select('id, relationship, claimed_role, status, created_at')
    .eq('requester_user_id', user.id)
    .order('created_at', { ascending: false })

  const requests = (data ?? []) as Array<{
    id: string
    relationship: string
    claimed_role: string
    status: string
    created_at: string
  }>

  return (
    <div className="space-y-10">
      <FadeUp className="space-y-2">
        <p className="text-label">Representative access</p>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          Speak with someone&rsquo;s legacy
        </p>
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
          If you are an authorized representative of someone who has passed, you can request
          access to the memories and reflections they recorded. Access is verified, scoped to
          what they chose to share, time-limited, and fully logged.
        </p>
      </FadeUp>

      <FadeUp delay={0.05}>
        <Link
          href="/app/represent/new"
          className="inline-flex items-center bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-xs font-medium hover:opacity-90 transition-opacity"
        >
          Request access
        </Link>
      </FadeUp>

      {requests.length > 0 && (
        <FadeUp delay={0.1} className="space-y-3">
          <p className="text-label">Your requests</p>
          <div className="space-y-2">
            {requests.map((r) => (
              <Link
                key={r.id}
                href={`/app/represent/${r.id}`}
                className="block border border-border rounded-lg px-4 py-3 hover:border-foreground/30 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground capitalize truncate">
                      {r.claimed_role.replace(/_/g, ' ')} &middot; {r.relationship}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </FadeUp>
      )}
    </div>
  )
}
