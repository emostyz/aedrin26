import { createClient } from '@/lib/supabase/server'
import { cancelMemorialization } from '@/app/actions/memorialization'

const STATUS_LABELS: Record<string, string> = {
  pending:       'Pending — executor has initiated, awaiting documents',
  docs_submitted:'Documents submitted — grace period active',
  grace_period:  'Grace period active',
  under_review:  'Under human review',
  approved:      'Approved — account is in legacy mode',
  rejected:      'Rejected',
  cancelled:     'Cancelled',
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
    .maybeSingle() as { data: {
      id: string; status: string; grace_period_ends_at: string | null;
      initiated_by_executor_email: string; created_at: string
    } | null }

  const canCancel = request && ['pending','docs_submitted','grace_period'].includes(request.status)

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Memorialization status</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          If a memorialization request is active, you can cancel it here during the grace period.
        </p>
      </div>

      {!request ? (
        <div className="rounded-lg border border-border px-5 py-6">
          <p className="text-sm text-muted-foreground">No active memorialization request.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border px-5 py-5 space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
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
                className="rounded-md border border-destructive/50 px-4 py-2 text-sm text-destructive hover:bg-destructive/5 transition-colors">
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
    </div>
  )
}
