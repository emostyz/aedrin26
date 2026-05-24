import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

type Params = { params: Promise<{ requestId: string }> }

// POST /api/admin/memorialization/[requestId]
// Body: { action: 'approve' | 'reject', notes?: string }
// Header: x-admin-secret: $ADMIN_SECRET
// This is the human review step — called by an operator, not automated.
export async function POST(request: NextRequest, { params }: Params) {
  const secret = request.headers.get('x-admin-secret')
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { requestId } = await params
  const body = await request.json() as { action: 'approve' | 'reject'; notes?: string }

  if (!['approve', 'reject'].includes(body.action)) {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: req } = await service
    .from('memorialization_requests')
    .select('id, user_id, status')
    .eq('id', requestId)
    .single() as { data: { id: string; user_id: string; status: string } | null }

  if (!req) return NextResponse.json({ error: 'Request not found.' }, { status: 404 })

  if (!['docs_submitted', 'grace_period', 'under_review'].includes(req.status)) {
    return NextResponse.json({
      error: `Cannot act on a request with status '${req.status}'.`
    }, { status: 400 })
  }

  const newStatus = body.action === 'approve' ? 'approved' : 'rejected'

  const { error: updateError } = await service
    .from('memorialization_requests')
    .update({
      status: newStatus,
      decided_by: 'admin',
      decided_at: new Date().toISOString(),
      notes: body.notes ?? null,
    })
    .eq('id', requestId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  if (body.action === 'approve') {
    // Flip account to legacy_active and activate heir access_status
    const [userUpdate, heirUpdate] = await Promise.all([
      service.from('users')
        .update({ account_state: 'legacy_active' })
        .eq('id', req.user_id),
      service.from('heirs')
        .update({ access_status: 'active' })
        .eq('user_id', req.user_id),
    ])
    if (userUpdate.error) return NextResponse.json({ error: userUpdate.error.message }, { status: 500 })
    if (heirUpdate.error) return NextResponse.json({ error: heirUpdate.error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, status: newStatus })
}
