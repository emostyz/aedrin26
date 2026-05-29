'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAdmin } from '../layout'
import type { Domain } from '@/lib/supabase/types'

const DOMAINS: Domain[] = ['childhood', 'family', 'career', 'values', 'beliefs', 'lessons', 'messages', 'other']

interface AccessRequest {
  id: string
  deceasedName: string
  deceasedEmail: string | null
  requester_email: string
  claimed_role: string
  relationship: string
  message: string | null
  risk_level: string | null
  risk_reasons: string | null
  created_at: string
  documents: Array<{ type: string; url: string | null }>
}

export default function AdminAccessRequestsPage() {
  const { secret, authed } = useAdmin()
  const [requests, setRequests] = useState<AccessRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [domainSel, setDomainSel] = useState<Record<string, Set<Domain>>>({})

  const load = useCallback(async () => {
    if (!secret) return
    setError(null); setBusy(true)
    try {
      const res = await fetch('/api/admin/access-requests', { headers: { 'x-admin-secret': secret } })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to load.'); return }
      setRequests(json.requests)
    } finally { setBusy(false) }
  }, [secret])

  useEffect(() => { if (authed) load() }, [authed, load])

  function toggleDomain(reqId: string, d: Domain) {
    setDomainSel((prev) => {
      const next = new Set(prev[reqId] ?? [])
      if (next.has(d)) next.delete(d); else next.add(d)
      return { ...prev, [reqId]: next }
    })
  }

  async function decide(reqId: string, action: 'approve' | 'reject') {
    setError(null); setBusy(true)
    try {
      const res = await fetch(`/api/admin/access-requests/${reqId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({ action, domains: Array.from(domainSel[reqId] ?? []) }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Action failed.'); return }
      await load()
    } finally { setBusy(false) }
  }

  if (!authed) return <p className="text-sm text-muted-foreground">Enter your admin secret above.</p>

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-label">Access requests</p>
          <p className="text-sm text-muted-foreground">Escalated representative access requests awaiting review.</p>
        </div>
        <button
          onClick={load} disabled={busy}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
        >
          {busy ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

      {requests && requests.length === 0 && (
        <p className="text-sm text-muted-foreground">No requests awaiting review.</p>
      )}

      {requests && requests.map((r) => (
        <div key={r.id} className="border border-border rounded-lg p-4 space-y-3">
          <div className="space-y-1">
            <p className="text-sm text-foreground">
              <span className="capitalize">{r.claimed_role.replace(/_/g, ' ')}</span> · {r.relationship}
            </p>
            <p className="text-xs text-muted-foreground">Requester: {r.requester_email}</p>
            <p className="text-xs text-muted-foreground">Subject: {r.deceasedName} ({r.deceasedEmail})</p>
            {r.risk_level && (
              <p className="text-xs text-muted-foreground">
                Risk: <span className={r.risk_level === 'high' ? 'text-destructive' : 'text-foreground'}>{r.risk_level}</span>
                {r.risk_reasons ? ` — ${r.risk_reasons}` : ''}
              </p>
            )}
            {r.message && <p className="text-xs text-muted-foreground italic">“{r.message}”</p>}
          </div>

          <div className="space-y-1">
            <p className="text-label">Documents</p>
            {r.documents.length === 0 && <p className="text-xs text-muted-foreground">None provided.</p>}
            {r.documents.map((d, i) => (
              d.url
                ? <a key={i} href={d.url} target="_blank" rel="noreferrer" className="block text-xs text-foreground underline underline-offset-2">{d.type}</a>
                : <p key={i} className="text-xs text-muted-foreground">{d.type} (unavailable)</p>
            ))}
          </div>

          <div className="space-y-1.5">
            <p className="text-label">Grant domains (for new grants)</p>
            <div className="flex flex-wrap gap-1.5">
              {DOMAINS.map((d) => {
                const on = (domainSel[r.id] ?? new Set()).has(d)
                return (
                  <button
                    key={d}
                    onClick={() => toggleDomain(r.id, d)}
                    className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${on ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:border-foreground/30'}`}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => decide(r.id, 'reject')} disabled={busy}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
            >
              Reject
            </button>
            <button
              onClick={() => decide(r.id, 'approve')} disabled={busy}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity ml-auto"
            >
              Approve &amp; grant
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
