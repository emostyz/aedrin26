'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAdmin } from '../layout'

interface MemRequest {
  id: string
  deceasedName: string
  deceasedEmail: string | null
  initiated_by_executor_email: string
  status: string
  grace_period_ends_at: string | null
  created_at: string
  documentCount: number
  notes: string | null
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:        { label: 'Pending',         color: 'text-muted-foreground' },
  docs_submitted: { label: 'Docs submitted',  color: 'text-amber-400'        },
  grace_period:   { label: 'Grace period',    color: 'text-amber-400'        },
  under_review:   { label: 'Under review',    color: 'text-orange-400'       },
}

function daysUntil(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = new Date(dateStr).getTime() - Date.now()
  const days = Math.ceil(diff / 86400000)
  if (days < 0) return 'Expired'
  if (days === 0) return 'Today'
  return `${days}d`
}

export default function AdminMemorializationPage() {
  const { secret, authed } = useAdmin()
  const [requests, setRequests] = useState<MemRequest[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null) // requestId being acted on
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    if (!secret) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/admin/memorialization', { headers: { 'x-admin-secret': secret } })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed.'); return }
      setRequests(json.requests)
    } catch { setError('Network error.') } finally { setLoading(false) }
  }, [secret])

  useEffect(() => { if (authed) load() }, [authed, load])

  async function decide(requestId: string, action: 'approve' | 'reject') {
    setBusy(requestId)
    try {
      const res = await fetch(`/api/admin/memorialization/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ action, notes: notes[requestId] ?? null }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Action failed.'); return }
      await load()
    } finally { setBusy(null) }
  }

  if (!authed) return <p className="text-sm text-muted-foreground">Enter your admin secret above.</p>

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-label">Memorialization queue</p>
          <p className="text-sm text-muted-foreground">
            Review death verification requests after the 30-day grace period.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

      {requests && requests.length === 0 && (
        <p className="text-sm text-muted-foreground">No requests awaiting review.</p>
      )}

      {requests && requests.map((r) => {
        const statusMeta = STATUS_LABELS[r.status] ?? { label: r.status, color: 'text-muted-foreground' }
        const isBusy = busy === r.id
        const canDecide = ['under_review', 'docs_submitted', 'grace_period'].includes(r.status)

        return (
          <div key={r.id} className="border border-border rounded-xl p-5 space-y-4">
            {/* Header row */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">{r.deceasedName}</p>
                <p className="text-xs text-muted-foreground">{r.deceasedEmail ?? 'email unknown'}</p>
              </div>
              <span className={`text-xs font-medium ${statusMeta.color}`}>{statusMeta.label}</span>
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-xs">
              <div>
                <p className="text-muted-foreground">Executor</p>
                <p className="text-foreground">{r.initiated_by_executor_email}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Initiated</p>
                <p className="text-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Grace ends</p>
                <p className={`${daysUntil(r.grace_period_ends_at) === 'Expired' ? 'text-orange-400' : 'text-foreground'}`}>
                  {r.grace_period_ends_at
                    ? `${new Date(r.grace_period_ends_at).toLocaleDateString()} (${daysUntil(r.grace_period_ends_at)})`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Documents</p>
                <p className="text-foreground">{r.documentCount} file{r.documentCount !== 1 ? 's' : ''} uploaded</p>
              </div>
            </div>

            {/* Request ID */}
            <p className="text-[10px] text-muted-foreground/40 font-mono">{r.id}</p>

            {canDecide && (
              <div className="space-y-3 pt-1 border-t border-border">
                <textarea
                  rows={2}
                  placeholder="Optional reviewer note (included in notification email)…"
                  value={notes[r.id] ?? ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => decide(r.id, 'reject')}
                    disabled={isBusy}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                  >
                    {isBusy ? '…' : 'Reject'}
                  </button>
                  <button
                    onClick={() => decide(r.id, 'approve')}
                    disabled={isBusy}
                    className="ml-auto bg-primary text-primary-foreground rounded-lg px-5 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
                  >
                    {isBusy ? 'Processing…' : 'Approve — unlock legacy mode'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
