import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail, sendEmails } from '@/lib/email'
import { graceExpiringEmail, graceExpiredAdminEmail } from '@/lib/email-templates'

// GET /api/cron/grace-period-check
// Runs daily (see vercel.json). Two jobs in one pass:
//  1. Warn account owners whose grace period expires in 5 days.
//  2. Move expired grace periods to under_review and alert admin.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Cron not configured.' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()
  const now = new Date()

  // ── 1. Warn users 5 days before grace period ends ──────────────────────────
  const warnCutoff = new Date(now)
  warnCutoff.setDate(warnCutoff.getDate() + 5)

  const { data: expiringSoon } = await service
    .from('memorialization_requests')
    .select('id, user_id, grace_period_ends_at')
    .eq('status', 'docs_submitted')
    .lte('grace_period_ends_at', warnCutoff.toISOString())
    .gte('grace_period_ends_at', now.toISOString()) as {
      data: Array<{ id: string; user_id: string; grace_period_ends_at: string }> | null
    }

  let warned = 0
  if (expiringSoon && expiringSoon.length > 0) {
    const userIds = expiringSoon.map((r) => r.user_id)
    const { data: users } = await service
      .from('users')
      .select('id, email, display_name, legal_name')
      .in('id', userIds) as {
        data: Array<{ id: string; email: string; display_name: string | null; legal_name: string }> | null
      }
    const userMap = new Map((users ?? []).map((u) => [u.id, u]))

    await sendEmails(
      expiringSoon.map((r) => {
        const u = userMap.get(r.user_id)
        if (!u) return null
        const deceasedName = u.display_name ?? u.legal_name
        const graceEnd = new Date(r.grace_period_ends_at)
        const tmpl = graceExpiringEmail(deceasedName, graceEnd)
        return { to: u.email, subject: tmpl.subject, html: tmpl.html }
      }).filter(Boolean) as { to: string; subject: string; html: string }[],
    )
    warned = expiringSoon.length
  }

  // ── 2. Move expired grace periods → under_review + alert admin ────────────
  const { data: expired } = await service
    .from('memorialization_requests')
    .select('id, user_id')
    .eq('status', 'docs_submitted')
    .lt('grace_period_ends_at', now.toISOString()) as {
      data: Array<{ id: string; user_id: string }> | null
    }

  let moved = 0
  if (expired && expired.length > 0) {
    const expiredIds = expired.map((r) => r.id)

    await service
      .from('memorialization_requests')
      .update({ status: 'under_review' })
      .in('id', expiredIds)

    const userIds = expired.map((r) => r.user_id)
    const { data: users } = await service
      .from('users')
      .select('id, display_name, legal_name')
      .in('id', userIds) as {
        data: Array<{ id: string; display_name: string | null; legal_name: string }> | null
      }
    const userMap = new Map((users ?? []).map((u) => [u.id, u]))

    const adminEmail = process.env.ADMIN_EMAIL
    if (adminEmail) {
      for (const r of expired) {
        const u = userMap.get(r.user_id)
        const deceasedName = u?.display_name ?? u?.legal_name ?? 'Unknown'
        const tmpl = graceExpiredAdminEmail(deceasedName, r.id)
        await sendEmail({ to: adminEmail, subject: tmpl.subject, html: tmpl.html })
      }
    }
    moved = expired.length
  }

  return NextResponse.json({ warned, moved })
}
