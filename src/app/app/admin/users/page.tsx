'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAdmin } from '../layout'

interface AdminUser {
  id: string
  email: string
  legal_name: string
  display_name: string | null
  account_state: string
  onboarding_complete: boolean
  reminders_enabled: boolean
  created_at: string
  last_reminded_on: string | null
  entryCount: number
  heirCount: number
}

const STATE_COLORS: Record<string, string> = {
  active:        'text-foreground',
  memorializing: 'text-amber-400',
  legacy_active: 'text-purple-400',
}

export default function AdminUsersPage() {
  const { secret, authed } = useAdmin()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const load = useCallback(async (p = 0) => {
    if (!secret) return
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ page: String(p) })
      if (search) params.set('search', search)
      if (stateFilter) params.set('state', stateFilter)
      const res = await fetch(`/api/admin/users?${params}`, { headers: { 'x-admin-secret': secret } })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed.'); return }
      setUsers(json.users)
      setHasMore(json.users.length === json.pageSize)
      setPage(p)
    } catch { setError('Network error.') } finally { setLoading(false) }
  }, [secret, search, stateFilter])

  useEffect(() => { if (authed) load(0) }, [authed, load])

  if (!authed) return <p className="text-sm text-muted-foreground">Enter your admin secret above.</p>

  return (
    <div className="space-y-6">
      <div className="space-y-0.5">
        <p className="text-label">All users</p>
        <p className="text-sm text-muted-foreground">Search, filter, and inspect user accounts.</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <input
          type="search"
          placeholder="Search email or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(0)}
          className="flex-1 min-w-48 bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <select
          value={stateFilter}
          onChange={(e) => { setStateFilter(e.target.value); }}
          className="bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All states</option>
          <option value="active">Active</option>
          <option value="memorializing">Memorializing</option>
          <option value="legacy_active">Legacy</option>
        </select>
        <button
          onClick={() => load(0)}
          disabled={loading}
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

      {/* Table */}
      {users && users.length === 0 && (
        <p className="text-sm text-muted-foreground">No users found.</p>
      )}

      {users && users.length > 0 && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                {['Name / email', 'State', 'Entries', 'Heirs', 'Reminders', 'Joined', 'Last reminded'].map((h) => (
                  <th key={h} className="text-left text-muted-foreground font-normal py-2 px-2 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/30 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-2">
                    <p className="text-foreground font-medium">{u.display_name ?? u.legal_name}</p>
                    <p className="text-muted-foreground">{u.email}</p>
                  </td>
                  <td className={`py-3 px-2 capitalize ${STATE_COLORS[u.account_state] ?? 'text-muted-foreground'}`}>
                    {u.account_state.replace(/_/g, ' ')}
                  </td>
                  <td className="py-3 px-2 text-foreground tabular-nums">{u.entryCount}</td>
                  <td className="py-3 px-2 text-foreground tabular-nums">{u.heirCount}</td>
                  <td className="py-3 px-2">
                    <span className={u.reminders_enabled ? 'text-foreground' : 'text-muted-foreground'}>
                      {u.reminders_enabled ? 'On' : 'Off'}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-muted-foreground whitespace-nowrap">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-2 text-muted-foreground whitespace-nowrap">
                    {u.last_reminded_on ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {users && (users.length > 0 || page > 0) && (
        <div className="flex items-center gap-4">
          <button
            onClick={() => load(page - 1)}
            disabled={page === 0 || loading}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            ← Previous
          </button>
          <p className="text-xs text-muted-foreground">Page {page + 1}</p>
          <button
            onClick={() => load(page + 1)}
            disabled={!hasMore || loading}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
