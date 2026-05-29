import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmails } from '@/lib/email'
import { weeklyDigestEmail } from '@/lib/email-templates'

// GET /api/cron/weekly-digest
// Runs every Sunday at 10:00 UTC (see vercel.json).
// Sends each active opted-in user a summary of their week:
// entry count, streak, top domain, and that week's latest insight.
const MAX_BATCH = 200

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Cron not configured.' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()

  const { data: usersData } = await service
    .from('users')
    .select('id, email, display_name, legal_name')
    .eq('reminders_enabled', true)
    .eq('account_state', 'active')
    .eq('onboarding_complete', true)
    .limit(MAX_BATCH) as {
      data: Array<{ id: string; email: string; display_name: string | null; legal_name: string }> | null
    }

  const users = usersData ?? []
  if (users.length === 0) return NextResponse.json({ sent: 0 })

  const ids = users.map((u) => u.id)

  // Week window: last 7 days
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString()
  const thisWeekStart = weekAgo.toISOString().slice(0, 10)

  const [entriesRes, allEntriesRes, insightsRes] = await Promise.all([
    // Entries from the past 7 days (for weekly count + domain breakdown)
    service
      .from('soul_entries')
      .select('user_id, domain, created_at')
      .in('user_id', ids)
      .gte('created_at', weekAgoStr),
    // Total entry count per user
    service
      .from('soul_entries')
      .select('user_id')
      .in('user_id', ids),
    // Latest insight for each user (for the quote block)
    service
      .from('daily_insights')
      .select('user_id, insight_text, delivered_date')
      .in('user_id', ids)
      .gte('delivered_date', thisWeekStart)
      .order('delivered_date', { ascending: false }),
  ])

  type EntryRow = { user_id: string; domain: string; created_at: string }
  type InsightRow = { user_id: string; insight_text: string; delivered_date: string }

  const weekEntries = (entriesRes.data ?? []) as EntryRow[]
  const allEntries = (allEntriesRes.data ?? []) as { user_id: string }[]
  const insights = (insightsRes.data ?? []) as InsightRow[]

  // Index by user
  const weekCountByUser = new Map<string, number>()
  const totalCountByUser = new Map<string, number>()
  const domainCountByUser = new Map<string, Map<string, number>>()
  const latestInsightByUser = new Map<string, string>()

  for (const e of weekEntries) {
    weekCountByUser.set(e.user_id, (weekCountByUser.get(e.user_id) ?? 0) + 1)
    const dm = domainCountByUser.get(e.user_id) ?? new Map<string, number>()
    dm.set(e.domain, (dm.get(e.domain) ?? 0) + 1)
    domainCountByUser.set(e.user_id, dm)
  }
  for (const e of allEntries) {
    totalCountByUser.set(e.user_id, (totalCountByUser.get(e.user_id) ?? 0) + 1)
  }
  for (const ins of insights) {
    if (!latestInsightByUser.has(ins.user_id)) {
      latestInsightByUser.set(ins.user_id, ins.insight_text)
    }
  }

  // Build streak per user (consecutive days with at least one entry, going back from today)
  const entriesByUserDate = new Map<string, Set<string>>()
  for (const e of weekEntries) {
    const key = `${e.user_id}::${e.created_at.slice(0, 10)}`
    if (!entriesByUserDate.has(e.user_id)) entriesByUserDate.set(e.user_id, new Set())
    entriesByUserDate.get(e.user_id)!.add(e.created_at.slice(0, 10))
  }

  function streakFromDates(dates: Set<string>): number {
    let streak = 0
    const d = new Date()
    while (true) {
      if (dates.has(d.toISOString().slice(0, 10))) {
        streak++
        d.setDate(d.getDate() - 1)
      } else break
      if (streak > 7) break
    }
    return streak
  }

  await sendEmails(
    users.map((u) => {
      const firstName = (u.display_name ?? u.legal_name ?? '').split(' ')[0] ?? ''
      const entriesThisWeek = weekCountByUser.get(u.id) ?? 0
      const totalEntries = totalCountByUser.get(u.id) ?? 0
      const streak = streakFromDates(entriesByUserDate.get(u.id) ?? new Set())
      const domainMap = domainCountByUser.get(u.id)
      const topDomain = domainMap
        ? [...domainMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
        : null
      const insightText = latestInsightByUser.get(u.id) ?? null

      const tmpl = weeklyDigestEmail(firstName, { entriesThisWeek, totalEntries, streak, topDomain, insightText })
      return { to: u.email, subject: tmpl.subject, html: tmpl.html }
    }),
  )

  return NextResponse.json({ sent: users.length })
}
