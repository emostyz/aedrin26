import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FadeUp } from '@/components/ui/motion'
import { RepresentDetail } from '@/components/represent/represent-detail'

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>
}) {
  const { requestId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: reqData } = await supabase
    .from('access_requests')
    .select('id, deceased_user_id, claimed_role, relationship, status, risk_level, attestation_accepted_at')
    .eq('id', requestId)
    .maybeSingle()

  const request = reqData as {
    id: string
    deceased_user_id: string
    claimed_role: string
    relationship: string
    status: string
    risk_level: string | null
    attestation_accepted_at: string | null
  } | null

  if (!request) {
    return (
      <div className="space-y-4">
        <p className="text-label">Representative access</p>
        <p className="text-sm text-muted-foreground">This request could not be found.</p>
        <Link href="/app/represent" className="text-xs text-foreground hover:opacity-70">← Back to requests</Link>
      </div>
    )
  }

  const { data: docsData } = await supabase
    .from('access_request_documents')
    .select('id, type, uploaded_at')
    .eq('request_id', requestId)
    .order('uploaded_at', { ascending: true })

  const documents = (docsData ?? []) as Array<{ id: string; type: string; uploaded_at: string }>

  return (
    <div className="space-y-8 max-w-md">
      <FadeUp className="space-y-2">
        <Link href="/app/represent" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← All requests
        </Link>
        <p className="text-[1.5rem] font-light tracking-[-0.02em] text-foreground leading-snug capitalize">
          {request.claimed_role.replace(/_/g, ' ')} &middot; {request.relationship}
        </p>
      </FadeUp>

      <FadeUp delay={0.05}>
        <RepresentDetail
          requestId={request.id}
          deceasedUserId={request.deceased_user_id}
          status={request.status}
          riskLevel={request.risk_level}
          documents={documents}
        />
      </FadeUp>
    </div>
  )
}
