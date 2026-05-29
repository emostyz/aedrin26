import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// GET /api/admin/memorialization
// Lists all non-terminal memorialization requests for the admin queue.
export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret')
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()

  const { data: requests } = await service
    .from('memorialization_requests')
    .select('id, user_id, initiated_by_executor_email, status, grace_period_ends_at, decided_by, decided_at, notes, created_at, updated_at')
    .not('status', 'in', '(approved,rejected,cancelled)')
    .order('created_at', { ascending: true }) as {
      data: Array<{
        id: string
        user_id: string
        initiated_by_executor_email: string
        status: string
        grace_period_ends_at: string | null
        decided_by: string | null
        decided_at: string | null
        notes: string | null
        created_at: string
        updated_at: string
      }> | null
    }

  const list = requests ?? []

  // Enrich with deceased user info + document count
  const enriched = await Promise.all(
    list.map(async (r) => {
      const [userRes, docsRes] = await Promise.all([
        service.from('users').select('legal_name, display_name, email, account_state').eq('id', r.user_id).maybeSingle(),
        service.from('verification_documents').select('id', { count: 'exact', head: true }).eq('request_id', r.id),
      ])
      const u = userRes.data as { legal_name: string; display_name: string | null; email: string; account_state: string } | null
      return {
        ...r,
        deceasedName: u?.display_name ?? u?.legal_name ?? 'Unknown',
        deceasedEmail: u?.email ?? null,
        accountState: u?.account_state ?? null,
        documentCount: docsRes.count ?? 0,
      }
    }),
  )

  return NextResponse.json({ requests: enriched })
}
