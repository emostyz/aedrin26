import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { Domain } from '@/lib/supabase/types'

type Params = { params: Promise<{ requestId: string }> }

const ALL_DOMAINS: Domain[] = ['childhood', 'family', 'career', 'values', 'beliefs', 'lessons', 'messages', 'other']
const GRANT_DAYS = 90

// POST /api/admin/access-requests/[requestId]
// Body: { action: 'approve' | 'reject', reviewNotes?: string, domains?: Domain[] }
// Header: x-admin-secret: $ADMIN_SECRET
// Human escalation step. Approving grants scoped, time-bound, audited access.
export async function POST(request: NextRequest, { params }: Params) {
  const secret = request.headers.get('x-admin-secret')
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { requestId } = await params
  const body = await request.json() as { action: 'approve' | 'reject'; reviewNotes?: string; domains?: Domain[] }

  if (!['approve', 'reject'].includes(body.action)) {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: req } = (await service
    .from('access_requests')
    .select('id, deceased_user_id, requester_user_id, requester_email, relationship, status')
    .eq('id', requestId)
    .maybeSingle()) as {
    data: {
      id: string
      deceased_user_id: string
      requester_user_id: string
      requester_email: string
      relationship: string
      status: string
    } | null
  }

  if (!req) return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
  if (req.status !== 'pending_review') {
    return NextResponse.json({ error: `Cannot act on a request with status '${req.status}'.` }, { status: 400 })
  }

  const now = new Date().toISOString()

  if (body.action === 'reject') {
    const { error } = await service
      .from('access_requests')
      .update({ status: 'rejected', decided_by: 'admin', decided_at: now, review_notes: body.reviewNotes ?? null })
      .eq('id', requestId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, status: 'rejected' })
  }

  // ── Approve: grant scoped, time-bound, audited access ──────────────────────
  // Only meaningful once the subject account is legacy_active.
  const { data: deceased } = (await service
    .from('users')
    .select('account_state')
    .eq('id', req.deceased_user_id)
    .maybeSingle()) as { data: { account_state: string } | null }

  if (deceased?.account_state !== 'legacy_active') {
    return NextResponse.json(
      { error: 'Subject account is not yet legacy_active; access cannot be granted.' },
      { status: 400 },
    )
  }

  const expiresAt = new Date(Date.now() + GRANT_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Reuse a pre-designated heir if one matches; otherwise create one.
  const { data: existingHeir } = (await service
    .from('heirs')
    .select('id')
    .eq('user_id', req.deceased_user_id)
    .eq('email', req.requester_email)
    .maybeSingle()) as { data: { id: string } | null }

  let heirId: string
  if (existingHeir) {
    heirId = existingHeir.id
    await service
      .from('heirs')
      .update({
        access_status: 'active',
        verified_at: now,
        verification_request_id: requestId,
        access_expires_at: expiresAt,
        can_negotiate: true,
      })
      .eq('id', heirId)
    // Keep the author's domain permissions as-is for pre-designated heirs.
  } else {
    const { data: requester } = (await service
      .from('users')
      .select('legal_name')
      .eq('id', req.requester_user_id)
      .maybeSingle()) as { data: { legal_name: string } | null }

    const { data: newHeir, error: heirErr } = (await service
      .from('heirs')
      .insert({
        user_id: req.deceased_user_id,
        name: requester?.legal_name ?? req.requester_email,
        relationship: req.relationship,
        email: req.requester_email,
        access_status: 'active',
        verified_at: now,
        verification_request_id: requestId,
        access_expires_at: expiresAt,
        can_negotiate: true,
      })
      .select('id')
      .single()) as { data: { id: string } | null; error: { message: string } | null }

    if (heirErr || !newHeir) {
      return NextResponse.json({ error: heirErr?.message ?? 'Could not create grant.' }, { status: 500 })
    }
    heirId = newHeir.id

    // Least privilege: only the admin-selected domains are allowed (default: messages).
    const requested = (body.domains ?? []).filter((d) => ALL_DOMAINS.includes(d))
    const granted = requested.length > 0 ? requested : (['messages'] as Domain[])
    const perms = ALL_DOMAINS.map((domain) => ({ heir_id: heirId, domain, allowed: granted.includes(domain) }))
    await service.from('heir_permissions').insert(perms)
  }

  const { error: reqErr } = await service
    .from('access_requests')
    .update({ status: 'approved', decided_by: 'admin', decided_at: now, review_notes: body.reviewNotes ?? null })
    .eq('id', requestId)
  if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 500 })

  return NextResponse.json({ success: true, status: 'approved' })
}
