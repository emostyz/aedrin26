import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail, sendEmails } from '@/lib/email'
import {
  heirAccessLiveEmail,
  memorializationApprovedEmail,
  memorializationRejectedEmail,
  finalLetterEmail,
} from '@/lib/email-templates'

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

  // Fetch deceased user + executor email for notifications
  const { data: deceased } = await service.from('users')
    .select('legal_name, display_name, email').eq('id', req.user_id).maybeSingle() as
    { data: { legal_name: string; display_name: string | null; email: string } | null }
  const deceasedName = deceased?.display_name ?? deceased?.legal_name ?? 'the account holder'

  const { data: memReq } = await service
    .from('memorialization_requests')
    .select('initiated_by_executor_email')
    .eq('id', requestId)
    .single() as { data: { initiated_by_executor_email: string } | null }
  const executorEmail = memReq?.initiated_by_executor_email

  if (body.action === 'approve') {
    // Flip account to legacy_active and activate heir access_status
    const [userUpdate, heirUpdate] = await Promise.all([
      service.from('users').update({ account_state: 'legacy_active' }).eq('id', req.user_id),
      service.from('heirs').update({ access_status: 'active' }).eq('user_id', req.user_id),
    ])
    if (userUpdate.error) return NextResponse.json({ error: userUpdate.error.message }, { status: 500 })
    if (heirUpdate.error) return NextResponse.json({ error: heirUpdate.error.message }, { status: 500 })

    const { data: heirs } = await service.from('heirs')
      .select('id, name, email').eq('user_id', req.user_id).eq('access_status', 'active') as
      { data: { id: string; name: string; email: string }[] | null }

    // Deliver any final letters bound to specific heirs
    const { data: letters } = await service.from('soul_entries')
      .select('content, bound_recipient_id')
      .eq('user_id', req.user_id)
      .eq('domain', 'messages')
      .not('bound_recipient_id', 'is', null) as
      { data: { content: string; bound_recipient_id: string }[] | null }

    const executorTmpl = memorializationApprovedEmail(deceasedName)

    const letterEmails: { to: string; subject: string; html: string }[] = []
    if (letters && heirs) {
      for (const letter of letters) {
        const heir = heirs.find((h) => h.id === letter.bound_recipient_id)
        if (heir) {
          const lt = finalLetterEmail(deceasedName, heir.name, letter.content)
          letterEmails.push({ to: heir.email, subject: lt.subject, html: lt.html })
        }
      }
    }

    // Per-heir template — the activation email now deep-links to the
    // legacy page for THIS deceased user, and reminds the heir which
    // email to sign up with if they don't have an account yet.
    const heirEmails = (heirs ?? []).map((h) => {
      const tmpl = heirAccessLiveEmail(deceasedName, req.user_id, h.email)
      return { to: h.email, subject: tmpl.subject, html: tmpl.html }
    })

    await sendEmails([
      ...heirEmails,
      ...(executorEmail ? [{ to: executorEmail, subject: executorTmpl.subject, html: executorTmpl.html }] : []),
      ...letterEmails,
    ])
  } else {
    // Restore account state to active on rejection
    await service.from('users').update({ account_state: 'active' }).eq('id', req.user_id)

    if (executorEmail) {
      const tmpl = memorializationRejectedEmail(deceasedName, body.notes)
      await sendEmail({ to: executorEmail, subject: tmpl.subject, html: tmpl.html })
    }
  }

  return NextResponse.json({ success: true, status: newStatus })
}
