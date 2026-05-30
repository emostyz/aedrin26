import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmails } from '@/lib/email'
import { dailyReminderEmail } from '@/lib/email-templates'
import { signReplyToken } from '@/lib/reply-token'

// GET /api/cron/daily-reminders
// Invoked daily by Vercel Cron (see vercel.json). Vercel attaches
// Authorization: Bearer $CRON_SECRET when CRON_SECRET is configured.
// Emails active users who have not reflected today, then records the send so
// no one is emailed twice in a day.
const MAX_BATCH = 300

/** Count consecutive days with at least one entry, working backwards from yesterday. */
function calcStreak(entryDates: string[], todayStr: string): number {
  const daySet = new Set(entryDates.map((d) => d.slice(0, 10)))
  let streak = 0
  const base = new Date(todayStr)
  for (let i = 1; i <= 30; i++) {
    const d = new Date(base)
    d.setDate(d.getDate() - i)
    if (daySet.has(d.toISOString().slice(0, 10))) {
      streak++
    } else {
      break
    }
  }
  return streak
}

/** Pick one entry from the list at random and return a trimmed snippet. */
function pickPastEntry(
  entries: Array<{ content: string; domain: string; created_at: string }>,
  todayStr: string,
): { content: string; domain: string; daysAgo: number } | null {
  if (!entries.length) return null
  const e = entries[Math.floor(Math.random() * entries.length)]
  // Trim to first ~40 words so the pull-quote stays short
  const words = e.content.trim().split(/\s+/).filter(Boolean)
  const snippet = words.slice(0, 40).join(' ') + (words.length > 40 ? '…' : '')
  const daysAgo = Math.max(
    7,
    Math.round((new Date(todayStr).getTime() - new Date(e.created_at).getTime()) / 86_400_000),
  )
  return { content: snippet, domain: e.domain, daysAgo }
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Cron not configured (CRON_SECRET).' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)
  const todayStart = `${today}T00:00:00.000Z`

  // Date windows for streak + past-entry queries
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const sevenDaysAgo  = new Date(Date.now() - 7  * 86_400_000).toISOString()
  const oneYearAgo    = new Date(Date.now() - 365 * 86_400_000).toISOString()

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

  // Four parallel queries: today's reflections, prompts, streak dates, past entries
  const [entriesRes, promptsRes, recentDatesRes, pastEntriesRes] = await Promise.all([
    // Who reflected today — to skip them
    service
      .from('soul_entries')
      .select('user_id')
      .in('user_id', ids)
      .gte('created_at', todayStart),

    // Prompt per user for today
    service
      .from('daily_prompts')
      .select('user_id, id, prompt_text, domain')
      .in('user_id', ids)
      .eq('delivered_date', today),

    // Entry dates in the last 30 days (before today) — for streak calculation
    service
      .from('soul_entries')
      .select('user_id, created_at')
      .in('user_id', ids)
      .gte('created_at', thirtyDaysAgo)
      .lt('created_at', todayStart),

    // Past entries from 7–365 days ago — for the "From your journal" pull-quote
    service
      .from('soul_entries')
      .select('user_id, content, domain, created_at')
      .in('user_id', ids)
      .gte('created_at', oneYearAgo)
      .lt('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(Math.min(ids.length * 4, 600)),
  ])

  const reflectedToday = new Set(
    ((entriesRes.data ?? []) as { user_id: string }[]).map((e) => e.user_id),
  )
  const promptByUser = new Map(
    ((promptsRes.data ?? []) as { user_id: string; id: string; prompt_text: string; domain: string }[])
      .map((p) => [p.user_id, p]),
  )

  // Group recent dates by user for streak calculation
  const recentDatesByUser = new Map<string, string[]>()
  for (const row of (recentDatesRes.data ?? []) as { user_id: string; created_at: string }[]) {
    const arr = recentDatesByUser.get(row.user_id) ?? []
    arr.push(row.created_at)
    recentDatesByUser.set(row.user_id, arr)
  }

  // Group past entries by user for pull-quote selection
  const pastEntriesByUser = new Map<string, Array<{ content: string; domain: string; created_at: string }>>()
  for (const row of (pastEntriesRes.data ?? []) as {
    user_id: string; content: string; domain: string; created_at: string
  }[]) {
    const arr = pastEntriesByUser.get(row.user_id) ?? []
    arr.push({ content: row.content, domain: row.domain, created_at: row.created_at })
    pastEntriesByUser.set(row.user_id, arr)
  }

  // Reply-to-save: only when inbound is configured (RESEND_INBOUND_DOMAIN).
  const inboundDomain = process.env.RESEND_INBOUND_DOMAIN
  const toRemind = candidates.filter((c) => !reflectedToday.has(c.id))

  await sendEmails(
    toRemind.map((c) => {
      const firstName = (c.display_name ?? c.legal_name ?? '').split(' ')[0]
      const prompt = promptByUser.get(c.id) ?? null
      let replyTo: string | undefined
      if (inboundDomain && prompt) {
        const token = signReplyToken({ u: c.id, p: prompt.id, d: prompt.domain, dt: today })
        if (token) replyTo = `reply+${token}@${inboundDomain}`
      }

      const streak    = calcStreak(recentDatesByUser.get(c.id) ?? [], today)
      const pastEntry = pickPastEntry(pastEntriesByUser.get(c.id) ?? [], today)

      const tmpl = dailyReminderEmail(firstName, prompt?.prompt_text ?? null, !!replyTo, streak, pastEntry)
      return { to: c.email, subject: tmpl.subject, html: tmpl.html, replyTo }
    }),
  )

  // Record the send (only for those we attempted) so we don't double-send today.
  if (toRemind.length > 0) {
    await service.from('users').update({ last_reminded_on: today }).in('id', toRemind.map((c) => c.id))
  }

  return NextResponse.json({
    reminded: toRemind.length,
    skippedAlreadyReflected: candidates.length - toRemind.length,
  })
}
