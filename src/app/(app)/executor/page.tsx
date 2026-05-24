import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { FadeUp, Stagger, StaggerItem } from '@/components/ui/motion'
import { ExecutorFlow } from '@/components/memorialization/executor-flow'

export default async function ExecutorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceClient()
  const { data: activeRequests } = await service
    .from('memorialization_requests')
    .select('id, status, grace_period_ends_at, created_at, user_id')
    .eq('initiated_by_executor_email', user.email!.toLowerCase())
    .not('status', 'in', '(approved,rejected,cancelled)')
    .order('created_at', { ascending: false }) as {
      data: { id: string; status: string; grace_period_ends_at: string | null; created_at: string; user_id: string }[] | null
    }

  const requests = activeRequests ?? []

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
    </div>
  )
}
