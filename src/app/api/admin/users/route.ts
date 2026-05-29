import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// GET /api/admin/users?search=&state=&page=0
// Returns a paginated list of users with entry counts and heir counts.
export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret')
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() ?? ''
  const state  = searchParams.get('state') ?? ''
  const page   = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10))
  const PAGE_SIZE = 25

  const service = createServiceClient()

  let query = service
    .from('users')
    .select('id, email, legal_name, display_name, account_state, onboarding_complete, reminders_enabled, created_at, last_reminded_on')
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

  if (state) query = query.eq('account_state', state)
  if (search) query = query.or(`email.ilike.%${search}%,legal_name.ilike.%${search}%,display_name.ilike.%${search}%`)

  const { data: users, error } = await query as {
    data: Array<{
      id: string
      email: string
      legal_name: string
      display_name: string | null
      account_state: string
      onboarding_complete: boolean
      reminders_enabled: boolean
      created_at: string
      last_reminded_on: string | null
    }> | null
    error: unknown
  }

  if (error) return NextResponse.json({ error: 'Query failed.' }, { status: 500 })

  // Enrich with entry + heir counts
  const ids = (users ?? []).map((u) => u.id)
  const [entriesRes, heirsRes] = await Promise.all([
    service.from('soul_entries').select('user_id').in('user_id', ids),
    service.from('heirs').select('user_id').in('user_id', ids),
  ])

  const entryCount = new Map<string, number>()
  const heirCount  = new Map<string, number>()
  for (const e of (entriesRes.data ?? [])) entryCount.set(e.user_id, (entryCount.get(e.user_id) ?? 0) + 1)
  for (const h of (heirsRes.data  ?? [])) heirCount.set(h.user_id,  (heirCount.get(h.user_id)  ?? 0) + 1)

  const enriched = (users ?? []).map((u) => ({
    ...u,
    entryCount: entryCount.get(u.id) ?? 0,
    heirCount:  heirCount.get(u.id)  ?? 0,
  }))

  return NextResponse.json({ users: enriched, page, pageSize: PAGE_SIZE })
}
