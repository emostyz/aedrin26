'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  joinNegotiation,
  postNegotiationMessage,
  createProposal,
  respondToProposal,
  setNegotiationStatus,
} from '@/app/actions/negotiation'

interface Participant {
  id: string
  displayName: string
  relationship: string
  relationshipContext: string | null
  nonNegotiables: string[]
}
interface Message {
  id: string
  authorType: string
  authorName: string
  content: string
  citedCount: number
  isMine: boolean
}
interface ProposalResponse {
  participantName: string
  response: string
  comment: string | null
  isMine: boolean
}
interface Proposal {
  id: string
  content: string
  status: string
  proposerName: string
  responses: ProposalResponse[]
}
interface Props {
  deceasedUserId: string
  deceasedName: string
  negotiation: { id: string; title: string; description: string | null; status: string }
  isCreator: boolean
  isParticipant: boolean
  participants: Participant[]
  messages: Message[]
  proposals: Proposal[]
}

export function NegotiationRoom(props: Props) {
  const { deceasedUserId, deceasedName, negotiation, isCreator, isParticipant, participants, messages, proposals } = props
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [mediating, setMediating] = useState(false)
  const [message, setMessage] = useState('')
  const [proposalText, setProposalText] = useState('')
  const isOpen = negotiation.status === 'open'

  function act(fn: () => Promise<{ error?: string }>) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (res?.error) { setError(res.error); return }
      router.refresh()
    })
  }

  function handleJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('negotiation_id', negotiation.id)
    act(() => joinNegotiation(fd))
  }

  function handlePost() {
    if (!message.trim()) return
    const fd = new FormData()
    fd.set('negotiation_id', negotiation.id)
    fd.set('content', message.trim())
    setMessage('')
    act(() => postNegotiationMessage(fd))
  }

  function handlePropose() {
    if (!proposalText.trim()) return
    const fd = new FormData()
    fd.set('negotiation_id', negotiation.id)
    fd.set('content', proposalText.trim())
    setProposalText('')
    act(() => createProposal(fd))
  }

  function handleRespond(proposalId: string, response: 'accept' | 'reject' | 'abstain') {
    const fd = new FormData()
    fd.set('negotiation_id', negotiation.id)
    fd.set('proposal_id', proposalId)
    fd.set('response', response)
    act(() => respondToProposal(fd))
  }

  async function handleMediate() {
    setError(null)
    setMediating(true)
    try {
      const res = await fetch('/api/negotiation/mediate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ negotiationId: negotiation.id }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'The mediator could not respond.'); return }
      router.refresh()
    } finally {
      setMediating(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-6 py-10 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Link href={`/app/legacy/${deceasedUserId}/negotiations`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← All negotiations
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[1.4rem] font-light tracking-[-0.02em] text-foreground leading-snug">{negotiation.title}</p>
            {negotiation.description && <p className="text-sm text-muted-foreground mt-1">{negotiation.description}</p>}
          </div>
          {isCreator && isOpen && (
            <button
              onClick={() => act(() => setNegotiationStatus(negotiation.id, 'closed'))}
              disabled={pending}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {negotiation.status === 'resolved' && (
        <div className="border border-foreground/20 bg-surface rounded-lg px-4 py-3">
          <p className="text-sm text-foreground">Resolved — all participants accepted a proposal.</p>
        </div>
      )}
      {(negotiation.status === 'closed' || negotiation.status === 'archived') && (
        <div className="border border-border rounded-lg px-4 py-3">
          <p className="text-sm text-muted-foreground">This negotiation is {negotiation.status}. It is read-only.</p>
        </div>
      )}

      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

      {!isParticipant ? (
        /* ── Join panel ─────────────────────────────────────────── */
        <form onSubmit={handleJoin} className="space-y-4 border border-border rounded-lg p-4">
          <p className="text-sm text-foreground">Join this negotiation</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Tell the others who you are and what you can&rsquo;t compromise on. The mediator will respect it.
          </p>
          <div className="space-y-1.5">
            <label htmlFor="relationship" className="text-label">Your relationship to {deceasedName.split(' ')[0]}</label>
            <input id="relationship" name="relationship" type="text" required maxLength={200}
              className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="relationship_context" className="text-label">
              Context <span className="normal-case font-normal text-muted-foreground">(optional)</span>
            </label>
            <input id="relationship_context" name="relationship_context" type="text" maxLength={500}
              placeholder="Anything that helps others understand your perspective"
              className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="non_negotiables" className="text-label">
              Your non-negotiables <span className="normal-case font-normal text-muted-foreground">(one per line)</span>
            </label>
            <textarea id="non_negotiables" name="non_negotiables" rows={3}
              className="w-full bg-input border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
          </div>
          <button type="submit" disabled={pending}
            className="bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity">
            {pending ? 'Joining…' : 'Join negotiation'}
          </button>
        </form>
      ) : (
        <>
          {/* ── Participants ───────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-label">Around the table</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {participants.map((p) => (
                <div key={p.id} className="border border-border rounded-lg p-3 space-y-1.5">
                  <p className="text-sm text-foreground">{p.displayName} <span className="text-muted-foreground">· {p.relationship}</span></p>
                  {p.relationshipContext && <p className="text-[11px] text-muted-foreground">{p.relationshipContext}</p>}
                  {p.nonNegotiables.length > 0 && (
                    <ul className="space-y-0.5 pt-1">
                      {p.nonNegotiables.map((n, i) => (
                        <li key={i} className="text-[11px] text-muted-foreground flex gap-1.5">
                          <span className="text-foreground/40">▪</span>{n}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Thread ─────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-label">Discussion</p>
              {isOpen && (
                <button onClick={handleMediate} disabled={mediating || pending}
                  className="text-[11px] text-foreground underline underline-offset-2 hover:opacity-70 disabled:opacity-40 transition-opacity">
                  {mediating ? 'Mediator thinking…' : 'Ask the mediator'}
                </button>
              )}
            </div>

            <div className="space-y-3">
              {messages.length === 0 && <p className="text-xs text-muted-foreground">No messages yet. Share where you stand, or ask the mediator to open.</p>}
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    m.authorType === 'mediator'
                      ? 'border border-foreground/20 bg-surface text-foreground'
                      : m.isMine
                        ? 'bg-foreground text-background'
                        : 'border border-border bg-surface/50 text-foreground'
                  }`}>
                    <p className="text-[10px] uppercase tracking-wider opacity-60 mb-1">{m.authorName}</p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap font-light">{m.content}</p>
                    {m.authorType === 'mediator' && m.citedCount > 0 && (
                      <p className="text-[10px] opacity-50 mt-1">{m.citedCount} recorded {m.citedCount === 1 ? 'memory' : 'memories'} referenced</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {isOpen && (
              <div className="flex items-end gap-2 pt-1">
                <textarea
                  value={message} onChange={(e) => setMessage(e.target.value)} rows={1}
                  placeholder="Share where you stand…"
                  className="flex-1 bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
                <button onClick={handlePost} disabled={pending || !message.trim()}
                  className="shrink-0 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-xs font-medium hover:opacity-90 disabled:opacity-30 transition-opacity">
                  Send
                </button>
              </div>
            )}
          </div>

          {/* ── Proposals ──────────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-label">Proposals</p>
            {proposals.length === 0 && <p className="text-xs text-muted-foreground">No proposals yet.</p>}
            {proposals.map((p) => (
              <div key={p.id} className="border border-border rounded-lg p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{p.content}</p>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">{p.status}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Proposed by {p.proposerName}</p>

                {p.responses.length > 0 && (
                  <ul className="space-y-0.5">
                    {p.responses.map((r, i) => (
                      <li key={i} className="text-[11px] text-muted-foreground">
                        {r.participantName}: <span className="text-foreground">{r.response}</span>
                        {r.comment ? ` — ${r.comment}` : ''}
                      </li>
                    ))}
                  </ul>
                )}

                {isOpen && p.status === 'proposed' && (
                  <div className="flex items-center gap-3 pt-1">
                    <button onClick={() => handleRespond(p.id, 'accept')} disabled={pending}
                      className="text-[11px] text-foreground hover:opacity-70 disabled:opacity-40 transition-opacity">Accept</button>
                    <button onClick={() => handleRespond(p.id, 'reject')} disabled={pending}
                      className="text-[11px] text-muted-foreground hover:text-destructive disabled:opacity-40 transition-colors">Reject</button>
                    <button onClick={() => handleRespond(p.id, 'abstain')} disabled={pending}
                      className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">Abstain</button>
                  </div>
                )}
              </div>
            ))}

            {isOpen && (
              <div className="flex items-end gap-2">
                <textarea
                  value={proposalText} onChange={(e) => setProposalText(e.target.value)} rows={1}
                  placeholder="Propose a way forward…"
                  className="flex-1 bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
                <button onClick={handlePropose} disabled={pending || !proposalText.trim()}
                  className="shrink-0 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-xs font-medium hover:opacity-90 disabled:opacity-30 transition-opacity">
                  Propose
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
