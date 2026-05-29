import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// GET /api/admin/stats
// Returns a snapshot of platform health for the admin dashboard.
export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret')
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()
  const now = new Date()
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7)
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30)
  const todayStart = now.toISOString().slice(0, 10) + 'T00:00:00.000Z'

  const [
    totalUsersRes,
    activeUsersRes,
    legacyUsersRes,
    newLast7Res,
    newLast30Res,
    totalEntriesRes,
    entriesTodayRes,
    pendingMemRes,
    pendingAccessRes,
    remindersEnabledRes,
  ] = await Promise.all([
    service.from('users').select('id', { count: 'exact', head: true }),
    service.from('users').select('id', { count: 'exact', head: true }).eq('account_state', 'active'),
    service.from('users').select('id', { count: 'exact', head: true }).eq('account_state', 'legacy_active'),
    service.from('users').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo.toISOString()),
    service.from('users').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo.toISOString()),
    service.from('soul_entries').select('id', { count: 'exact', head: true }),
    service.from('soul_entries').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
    service.from('memorialization_requests').select('id', { count: 'exact', head: true })
      .in('status', ['docs_submitted', 'under_review', 'grace_period']),
    service.from('access_requests').select('id', { count: 'exact', head: true })
      .eq('status', 'pending_review'),
    service.from('users').select('id', { count: 'exact', head: true }).eq('reminders_enabled', true),
  ])

  // Entry domain breakdown (last 30 days)
  const { data: domainBreakdown } = await service
    .from('soul_entries')
    .select('domain')
    .gte('created_at', thirtyDaysAgo.toISOString())

  const domainCounts: Record<string, number> = {}
  for (const e of (domainBreakdown ?? [])) {
    domainCounts[e.domain as string] = (domainCounts[e.domain as string] ?? 0) + 1
  }

  // Daily entry counts for the past 14 days (sparkline data)
  const { data: recentEntries } = await service
    .from('soul_entries')
    .select('created_at')
    .gte('created_at', new Date(now.getTime() - 14 * 86400000).toISOString())
    .order('created_at')

  const dailyCounts: Record<string, number> = {}
  for (const e of (recentEntries ?? [])) {
    const day = (e.created_at as string).slice(0, 10)
    dailyCounts[day] = (dailyCounts[day] ?? 0) + 1
  }
  // Fill in zeros for days with no entries
  const sparkline: { date: string; count: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    sparkline.push({ date: key, count: dailyCounts[key] ?? 0 })
  }

  return NextResponse.json({
    users: {
      total: totalUsersRes.count ?? 0,
      active: activeUsersRes.count ?? 0,
      legacy: legacyUsersRes.count ?? 0,
      newLast7: newLast7Res.count ?? 0,
      newLast30: newLast30Res.count ?? 0,
      remindersEnabled: remindersEnabledRes.count ?? 0,
    },
    entries: {
      total: totalEntriesRes.count ?? 0,
      today: entriesTodayRes.count ?? 0,
      byDomain: domainCounts,
      sparkline,
    },
    queues: {
      pendingMemorialization: pendingMemRes.count ?? 0,
      pendingAccessRequests: pendingAccessRes.count ?? 0,
    },
  })
}
