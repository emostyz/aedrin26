import { createClient } from '@/lib/supabase/server'
import { FadeUp } from '@/components/ui/motion'
import { cancelMemorialization } from '@/app/actions/memorialization'

const STATUS_LABELS: Record<string, string> = {
  pending:        'Pending — executor has initiated, awaiting documents',
  docs_submitted: 'Documents submitted — under grace period',
  grace_period:   'Grace period active',
  under_review:   'Under human review',
  approved:       'Approved — account is in legacy mode',
  rejected:       'Rejected',
  cancelled:      'Cancelled',
}

export default async function MemorializationStatusPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: request } = await supabase
    .from('memorialization_requests')
    .select('*')
    .eq('user_id', user.id)
    .not('status', 'in', '(approved,rejected,cancelled)')
    .maybeSingle() as {
      data: {
        id: string; status: string; grace_period_ends_at: string | null;
        initiated_by_executor_email: string; created_at: string
      } | null
    }

  const canCancel = request && ['pending','docs_submitted','grace_period'].includes(request.status)

  return (
    <div className="space-y-12">
      <FadeUp className="space-y-2">
        <p className="text-label">Memorialization</p>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          {request ? 'A request is active.' : 'No active request.'}
        </p>
        {request && (
          <p className="text-sm text-muted-foreground">
            Cancel during the grace period if this was initiated in error.
          </p>
        )}
      </FadeUp>

      <FadeUp delay={0.1}>
        {!request ? (
          <div className="border border-border rounded-lg px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No active memorialization request on your account.
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-lg px-5 py-5 space-y-5">
            <div className="space-y-1">
              <p className="text-sm text-foreground">
                {STATUS_LABELS[request.status] ?? request.status}
              </p>
              <p className="text-xs text-muted-foreground">
                Initiated by {request.initiated_by_executor_email} on{' '}
                {new Date(request.created_at).toLocaleDateString()}
              </p>
              {request.grace_period_ends_at && (
                <p className="text-xs text-muted-foreground">
                  Grace period ends {new Date(request.grace_period_ends_at).toLocaleDateString()}
                </p>
              )}
            </div>

            {canCancel && (
              <form action={async () => {
                'use server'
                await cancelMemorialization(request.id)
              }}>
                <button type="submit"
                  className="border border-destructive/40 text-destructive rounded-md px-5 py-2.5 text-xs font-medium hover:bg-destructive/5 transition-colors">
                  Cancel this request
                </button>
              </form>
            )}

            {!canCancel && request.status !== 'approved' && (
              <p className="text-xs text-muted-foreground">
                The grace period has ended. This request can no longer be cancelled.
              </p>
            )}
          </div>
        )}
      </FadeUp>
    </div>
  )
}
