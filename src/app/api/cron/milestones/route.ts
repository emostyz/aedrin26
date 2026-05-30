import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmails } from '@/lib/email'
import { milestoneEmail } from '@/lib/email-templates'

// GET /api/cron/milestones
// Runs daily. Checks each active user against known milestone thresholds
// and sends a one-time celebratory email the first time they cross each one.
// Milestone state is persisted as a JSONB column `milestones_sent` on users —
// if the column doesn't exist yet, the cron silently skips (safe).

type MilestoneKey = '1st_entry' | '10_entries' | '50_entries' | '7_domains' | '30_day_streak'
const ENTRY_MILESTONES: { key: MilestoneKey; threshold: number }[] = [
  { key: '1st_entry',   threshold: 1  },
  { key: '10_entries',  threshold: 10 },
  { key: '50_entries',  threshold: 50 },
]

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Cron not configured.' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()

  // Fetch active users with their milestone state
  const { data: usersData } = await service
    .from('users')
    .select('id, email, display_name, legal_name, milestones_sent')
    .eq('account_state', 'active')
    .eq('onboarding_complete', true)
    .limit(300)

  const users = (usersData ?? []) as Array<{
    id: string
    email: string
    display_name: string | null
    legal_name: string
    milestones_sent: Record<string, boolean> | null
  }>

  if (users.length === 0) return NextResponse.json({ sent: 0 })

  const ids = users.map((u) => u.id)

  // For streak detection we need dates in the last 31 days
  const thirtyOneDaysAgo = new Date(Date.now() - 31 * 86_400_000).toISOString()

  const [entriesRes, domainsRes, recentDatesRes] = await Promise.all([
    service.from('soul_entries').select('user_id').in('user_id', ids),
    service.from('soul_entries').select('user_id, domain').in('user_id', ids),
    service
      .from('soul_entries')
      .select('user_id, created_at')
      .in('user_id', ids)
      .gte('created_at', thirtyOneDaysAgo),
  ])

  type EntryRow = { user_id: string }
  type DomainRow = { user_id: string; domain: string }
  type DateRow = { user_id: string; created_at: string }

  const allEntries = (entriesRes.data ?? []) as EntryRow[]
  const allDomains = (domainsRes.data ?? []) as DomainRow[]
  const recentDates = (recentDatesRes.data ?? []) as DateRow[]

  const entryCountByUser = new Map<string, number>()
  for (const e of allEntries) {
    entryCountByUser.set(e.user_id, (entryCountByUser.get(e.user_id) ?? 0) + 1)
  }

  const domainSetByUser = new Map<string, Set<string>>()
  for (const e of allDomains) {
    const s = domainSetByUser.get(e.user_id) ?? new Set<string>()
    s.add(e.domain)
    domainSetByUser.set(e.user_id, s)
  }

  // Build date sets per user for streak computation
  const datesByUser = new Map<string, Set<string>>()
  for (const row of recentDates) {
    const daySet = datesByUser.get(row.user_id) ?? new Set<string>()
    daySet.add(row.created_at.slice(0, 10))
    datesByUser.set(row.user_id, daySet)
  }

  function computeStreak(daySet: Set<string>): number {
    let streak = 0
    const today = new Date()
    for (let i = 0; i <= 31; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      if (daySet.has(d.toISOString().slice(0, 10))) {
        streak++
      } else {
        break
      }
    }
    return streak
  }

  const emails: { to: string; subject: string; html: string }[] = []
  const updates: { id: string; milestones_sent: Record<string, boolean> }[] = []

  for (const u of users) {
    const sent = { ...(u.milestones_sent ?? {}) }
    const firstName = (u.display_name ?? u.legal_name ?? '').split(' ')[0] ?? ''
    const count = entryCountByUser.get(u.id) ?? 0
    const domains = domainSetByUser.get(u.id) ?? new Set<string>()
    const streak = computeStreak(datesByUser.get(u.id) ?? new Set<string>())
    let newMilestone = false

    for (const { key, threshold } of ENTRY_MILESTONES) {
      if (!sent[key] && count >= threshold) {
        const tmpl = milestoneEmail(firstName, key)
        emails.push({ to: u.email, subject: tmpl.subject, html: tmpl.html })
        sent[key] = true
        newMilestone = true
      }
    }

    if (!sent['7_domains'] && domains.size >= 7) {
      const tmpl = milestoneEmail(firstName, '7_domains')
      emails.push({ to: u.email, subject: tmpl.subject, html: tmpl.html })
      sent['7_domains'] = true
      newMilestone = true
    }

    if (!sent['30_day_streak'] && streak >= 30) {
      const tmpl = milestoneEmail(firstName, '30_day_streak')
      emails.push({ to: u.email, subject: tmpl.subject, html: tmpl.html })
      sent['30_day_streak'] = true
      newMilestone = true
    }

    if (newMilestone) updates.push({ id: u.id, milestones_sent: sent })
  }

  if (emails.length > 0) await sendEmails(emails)

  // Persist updated milestone state (best-effort; column may not exist yet)
  for (const upd of updates) {
    try {
      await service
        .from('users')
        .update({ milestones_sent: upd.milestones_sent } as Record<string, unknown>)
        .eq('id', upd.id)
    } catch { /* column may not exist yet — skip */ }
  }

  return NextResponse.json({ sent: emails.length })
}
