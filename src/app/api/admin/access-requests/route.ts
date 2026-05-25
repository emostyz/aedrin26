import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// GET /api/admin/access-requests
// Header: x-admin-secret: $ADMIN_SECRET
// Lists representative access requests escalated for human review, with
// signed URLs to the submitted identity/relationship documents.
export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret')
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()

  const { data: requests } = (await service
    .from('access_requests')
    .select('id, deceased_user_id, requester_email, claimed_role, relationship, message, status, risk_level, risk_reasons, created_at')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true })) as {
    data: Array<{
      id: string
      deceased_user_id: string
      requester_email: string
      claimed_role: string
      relationship: string
      message: string | null
      status: string
      risk_level: string | null
      risk_reasons: string | null
      created_at: string
    }> | null
  }

  const list = requests ?? []

  const enriched = await Promise.all(
    list.map(async (r) => {
      const [deceasedRes, docsRes] = await Promise.all([
        service.from('users').select('legal_name, display_name, email').eq('id', r.deceased_user_id).maybeSingle(),
        service.from('access_request_documents').select('document_url, type').eq('request_id', r.id),
      ])
      const deceased = deceasedRes.data as { legal_name: string; display_name: string | null; email: string } | null
      const docs = docsRes.data as { document_url: string; type: string }[] | null

      const signedDocs = await Promise.all(
        (docs ?? []).map(async (d) => {
          const { data: signed } = await service.storage
            .from('representative-documents')
            .createSignedUrl(d.document_url, 600)
          return { type: d.type, url: signed?.signedUrl ?? null }
        }),
      )

      return {
        ...r,
        deceasedName: deceased?.display_name ?? deceased?.legal_name ?? 'Unknown',
        deceasedEmail: deceased?.email ?? null,
        documents: signedDocs,
      }
    }),
  )

  return NextResponse.json({ requests: enriched })
}
