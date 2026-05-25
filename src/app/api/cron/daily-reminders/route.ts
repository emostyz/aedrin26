import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmails } from '@/lib/email'
import { dailyReminderEmail } from '@/lib/email-templates'

// GET /api/cron/daily-reminders
// Invoked daily by Vercel Cron (see vercel.json). Vercel attaches
// Authorization: Bearer $CRON_SECRET when CRON_SECRET is configured.
// Emails active users who have not reflected today, then records the send so
// no one is emailed twice in a day.
const MAX_BATCH = 300

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Cron not configured (CRON_SECRET).' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)
  const todayStart = `${today}T00:00:00.000Z`

  // Candidates: active, fully set-up users who opted in and weren't reminded today.
  const { data: candidatesData } = await service
    .from('users')
    .select('id, email, display_name, legal_name')
    .eq('reminders_enabled', true)
    .eq('account_state', 'active')
    .eq('onboarding_complete', true)
    .eq('setup_complete', true)
    .or(`last_reminded_on.is.null,last_reminded_on.neq.${today}`)
    .limit(MAX_BATCH)

  const candidates = (candidatesData ?? []) as Array<{
    id: string; email: string; display_name: string | null; legal_name: string
  }>
  if (candidates.length === 0) return NextResponse.json({ reminded: 0 })

  const ids = candidates.map((c) => c.id)

  // Who already reflected today, and what is each person's prompt for today.
  const [entriesRes, promptsRes] = await Promise.all([
    service.from('soul_entries').select('user_id').in('user_id', ids).gte('created_at', todayStart),
    service.from('daily_prompts').select('user_id, prompt_text').in('user_id', ids).eq('delivered_date', today),
  ])
  const reflectedToday = new Set(((entriesRes.data ?? []) as { user_id: string }[]).map((e) => e.user_id))
  const promptByUser = new Map(
    ((promptsRes.data ?? []) as { user_id: string; prompt_text: string }[]).map((p) => [p.user_id, p.prompt_text]),
  )

  const toRemind = candidates.filter((c) => !reflectedToday.has(c.id))

  await sendEmails(
    toRemind.map((c) => {
      const firstName = (c.display_name ?? c.legal_name ?? '').split(' ')[0]
      const tmpl = dailyReminderEmail(firstName, promptByUser.get(c.id) ?? null)
      return { to: c.email, subject: tmpl.subject, html: tmpl.html }
    }),
  )

  // Record the send (only for those we attempted) so we don't double-send today.
  if (toRemind.length > 0) {
    await service.from('users').update({ last_reminded_on: today }).in('id', toRemind.map((c) => c.id))
  }

  return NextResponse.json({ reminded: toRemind.length, skippedAlreadyReflected: candidates.length - toRemind.length })
}
