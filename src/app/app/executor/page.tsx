import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { FadeUp, Stagger, StaggerItem } from '@/components/ui/motion'
import { ExecutorFlow } from '@/components/memorialization/executor-flow'

type Request = { id: string; status: string; grace_period_ends_at: string | null; created_at: string; user_id: string }
type LogEntry = { id: string; deceased_user_id: string; heir_id: string; interaction_summary: string; accessed_at: string; entry_ids_accessed: string[] }

export default async function ExecutorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceClient()

  const [{ data: rawRequests }, { data: approvedRequests }] = await Promise.all([
    service
      .from('memorialization_requests')
      .select('id, status, grace_period_ends_at, created_at, user_id')
      .eq('initiated_by_executor_email', user.email!.toLowerCase())
      .not('status', 'in', '(approved,rejected,cancelled)')
      .order('created_at', { ascending: false }),
    service
      .from('memorialization_requests')
      .select('user_id')
      .eq('initiated_by_executor_email', user.email!.toLowerCase())
      .eq('status', 'approved'),
  ])

  const requests = (rawRequests ?? []) as Request[]
  const legacyUserIds = ((approvedRequests ?? []) as { user_id: string }[]).map((r) => r.user_id)

  // Fetch audit log for all accounts this executor has successfully memorialized
  let auditLog: LogEntry[] = []
  if (legacyUserIds.length > 0) {
    const { data } = await service
      .from('legacy_access_log')
      .select('id, deceased_user_id, heir_id, interaction_summary, accessed_at, entry_ids_accessed')
      .in('deceased_user_id', legacyUserIds)
      .order('accessed_at', { ascending: false })
      .limit(50)
    auditLog = (data ?? []) as LogEntry[]
  }

  return (
    <div className="space-y-16">
      <FadeUp className="space-y-2">
        <p className="text-label">Executor portal</p>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          Initiate the verification process.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          If you have been designated as executor for an AEDRIN account, you may initiate the
          memorialization process here. The account holder has 30 days to cancel.
        </p>
      </FadeUp>

      {requests.length > 0 && (
        <FadeUp delay={0.1}>
          <div className="space-y-4">
            <p className="text-label">Active requests</p>
            <Stagger className="space-y-2">
              {requests.map((req) => (
                <StaggerItem key={req.id}>
                  <div className="border border-border rounded-lg px-5 py-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-foreground capitalize">
                        {req.status.replace(/_/g, ' ')}
                      </p>
                      {req.grace_period_ends_at && (
                        <p className="text-xs text-muted-foreground">
                          Grace period ends {new Date(req.grace_period_ends_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Initiated {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </FadeUp>
      )}

      {requests.length === 0 && (
        <FadeUp delay={0.1}>
          <ExecutorFlow userEmail={user.email!} />
        </FadeUp>
      )}

      {/* §5.6 Legacy access audit log */}
      {auditLog.length > 0 && (
        <FadeUp delay={0.2}>
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <p className="text-label">Legacy access log</p>
              <p className="text-xs text-muted-foreground">{auditLog.length} interactions</p>
            </div>
            <p className="text-xs text-muted-foreground">
              All heir interactions with legacy accounts you have managed.
            </p>
            <div className="space-y-2">
              {auditLog.map((entry) => (
                <div key={entry.id} className="border border-border rounded-lg px-5 py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.accessed_at).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {entry.entry_ids_accessed?.length ?? 0} entries referenced
                    </p>
                  </div>
                  {entry.interaction_summary && (
                    <p className="text-xs text-foreground leading-relaxed truncate">
                      {entry.interaction_summary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </FadeUp>
      )}
    </div>
  )
}
