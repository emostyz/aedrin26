import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ExecutorFlow } from '@/components/memorialization/executor-flow'

export default async function ExecutorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Show any active requests this executor has initiated
  const service = createServiceClient()
  const { data: activeRequests } = await service
    .from('memorialization_requests')
    .select('id, status, grace_period_ends_at, created_at, user_id')
    .eq('initiated_by_executor_email', user.email!.toLowerCase())
    .not('status', 'in', '(approved,rejected,cancelled)')
    .order('created_at', { ascending: false }) as { data: { id: string; status: string; grace_period_ends_at: string | null; created_at: string; user_id: string }[] | null }

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Executor portal</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          If you have been designated as executor for an AEDRIN account, you may initiate the
          memorialization process here. This cannot be undone except by the account holder during
          the 30-day grace period.
        </p>
      </div>

      {(activeRequests ?? []).length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Active requests</h3>
          <ul className="space-y-2">
            {activeRequests!.map((req) => (
              <li key={req.id} className="rounded-lg border border-border px-5 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground capitalize">{req.status.replace('_', ' ')}</p>
                  {req.grace_period_ends_at && (
                    <p className="text-xs text-muted-foreground">
                      Grace period ends {new Date(req.grace_period_ends_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Initiated {new Date(req.created_at).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(activeRequests ?? []).length === 0 && (
        <ExecutorFlow userEmail={user.email!} />
      )}
    </div>
  )
}
