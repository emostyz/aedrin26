'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAdmin } from './layout'

interface Stats {
  users: {
    total: number
    active: number
    legacy: number
    newLast7: number
    newLast30: number
    remindersEnabled: number
  }
  entries: {
    total: number
    today: number
    byDomain: Record<string, number>
    sparkline: { date: string; count: number }[]
  }
  queues: {
    pendingMemorialization: number
    pendingAccessRequests: number
  }
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="border border-border rounded-xl p-5 space-y-1">
      <p className="text-[11px] text-muted-foreground uppercase tracking-[0.12em]">{label}</p>
      <p className="text-3xl font-light text-foreground tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function Sparkline({ data }: { data: { date: string; count: number }[] }) {
  if (!data.length) return null
  const max = Math.max(...data.map((d) => d.count), 1)
  const W = 280; const H = 48; const pad = 2
  const step = (W - pad * 2) / (data.length - 1)
  const points = data.map((d, i) => {
    const x = pad + i * step
    const y = H - pad - ((d.count / max) * (H - pad * 2))
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <svg width={W} height={H} className="mt-2">
      <polyline
        points={points}
        fill="none"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

function DomainBar({ domain, count, max }: { domain: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs text-muted-foreground w-20 capitalize shrink-0">{domain}</p>
      <div className="flex-1 bg-border/40 rounded-full h-1.5">
        <div className="bg-foreground/40 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-foreground tabular-nums w-6 text-right">{count}</p>
    </div>
  )
}

export default function AdminOverviewPage() {
  const { secret, authed } = useAdmin()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!secret) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/admin/stats', { headers: { 'x-admin-secret': secret } })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed.'); return }
      setStats(json)
    } catch { setError('Network error.') } finally { setLoading(false) }
  }, [secret])

  useEffect(() => { if (authed) load() }, [authed, load])

  if (!authed) return <p className="text-sm text-muted-foreground">Enter your admin secret above to unlock.</p>
  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!stats) return null

  const domainEntries = Object.entries(stats.entries.byDomain).sort((a, b) => b[1] - a[1])
  const maxDomain = domainEntries[0]?.[1] ?? 1

  const alerts: string[] = []
  if (stats.queues.pendingMemorialization > 0)
    alerts.push(`${stats.queues.pendingMemorialization} memorialization request${stats.queues.pendingMemorialization > 1 ? 's' : ''} need review`)
  if (stats.queues.pendingAccessRequests > 0)
    alerts.push(`${stats.queues.pendingAccessRequests} access request${stats.queues.pendingAccessRequests > 1 ? 's' : ''} awaiting decision`)

  return (
    <div className="space-y-10">
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="border border-amber-500/30 bg-amber-500/5 rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium text-amber-400 uppercase tracking-[0.1em]">Action needed</p>
          {alerts.map((a) => <p key={a} className="text-sm text-foreground">{a}</p>)}
        </div>
      )}

      {/* Users */}
      <div className="space-y-3">
        <p className="text-label">Users</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Total accounts" value={stats.users.total} />
          <StatCard label="Active" value={stats.users.active} />
          <StatCard label="Legacy mode" value={stats.users.legacy} />
          <StatCard label="New this week" value={stats.users.newLast7} sub="last 7 days" />
          <StatCard label="New this month" value={stats.users.newLast30} sub="last 30 days" />
          <StatCard label="Daily reminders on" value={stats.users.remindersEnabled} />
        </div>
      </div>

      {/* Entries */}
      <div className="space-y-3">
        <p className="text-label">Entries captured</p>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total" value={stats.entries.total.toLocaleString()} />
          <StatCard label="Today" value={stats.entries.today} />
        </div>

        {/* 14-day sparkline */}
        <div className="border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground mb-1">Entries per day — last 14 days</p>
          <Sparkline data={stats.entries.sparkline} />
          <div className="flex justify-between mt-1">
            <p className="text-[10px] text-muted-foreground/50">{stats.entries.sparkline[0]?.date}</p>
            <p className="text-[10px] text-muted-foreground/50">{stats.entries.sparkline[stats.entries.sparkline.length - 1]?.date}</p>
          </div>
        </div>

        {/* Domain breakdown */}
        {domainEntries.length > 0 && (
          <div className="border border-border rounded-xl p-5 space-y-3">
            <p className="text-xs text-muted-foreground">Entries by domain (last 30 days)</p>
            {domainEntries.map(([domain, count]) => (
              <DomainBar key={domain} domain={domain} count={count} max={maxDomain} />
            ))}
          </div>
        )}
      </div>

      {/* Queues */}
      <div className="space-y-3">
        <p className="text-label">Action queues</p>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Memorialization"
            value={stats.queues.pendingMemorialization}
            sub="awaiting review"
          />
          <StatCard
            label="Access requests"
            value={stats.queues.pendingAccessRequests}
            sub="escalated for review"
          />
        </div>
      </div>

      <button
        onClick={load}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Refresh
      </button>
    </div>
  )
}
