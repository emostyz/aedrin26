'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { submitForVerification, cancelAccessRequest } from '@/app/actions/representative'
import type { RepDocumentType } from '@/lib/supabase/types'

const DOC_TYPES: { value: RepDocumentType; label: string }[] = [
  { value: 'government_id', label: 'Photo ID' },
  { value: 'relationship_proof', label: 'Proof of relationship' },
  { value: 'other', label: 'Other' },
]

const DOC_LABEL: Record<string, string> = {
  government_id: 'Photo ID',
  relationship_proof: 'Proof of relationship',
  other: 'Other',
}

const STATUS_COPY: Record<string, { title: string; body: string }> = {
  submitted: { title: 'Add evidence, then submit', body: 'Optionally add identity or relationship documents, then submit for verification.' },
  docs_submitted: { title: 'Add evidence, then submit', body: 'Add more documents if you like, then submit for verification.' },
  pending_review: { title: 'Under review', body: 'Your request is being reviewed by our team. You’ll be notified once a decision is made.' },
  approved: { title: 'Approved', body: 'Your access has been verified and granted. It is scoped to what they chose to share and is time-limited.' },
  rejected: { title: 'Declined', body: 'This request was not approved. If you believe this is an error, you can submit a new request with more context.' },
  cancelled: { title: 'Cancelled', body: 'You cancelled this request.' },
  expired: { title: 'Expired', body: 'This request has expired.' },
}

interface Props {
  requestId: string
  deceasedUserId: string
  status: string
  riskLevel: string | null
  documents: Array<{ id: string; type: string; uploaded_at: string }>
}

export function RepresentDetail({ requestId, deceasedUserId, status: initialStatus, documents }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [attested, setAttested] = useState(false)
  const [docType, setDocType] = useState<RepDocumentType>('government_id')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const isOpen = status === 'submitted' || status === 'docs_submitted'
  const copy = STATUS_COPY[status] ?? { title: status, body: '' }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const buf = await file.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
      const res = await fetch('/api/represent/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, fileName: file.name, fileType: file.type, fileData: base64, docType }),
      })
      const json = await res.json()
      if (json.error) { setError(json.error); return }
      router.refresh()
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const res = await submitForVerification(requestId)
      if (res.error) { setError(res.error); return }
      if (res.status) setStatus(res.status)
      router.refresh()
    })
  }

  function handleCancel() {
    setError(null)
    startTransition(async () => {
      const res = await cancelAccessRequest(requestId)
      if (res.error) { setError(res.error); return }
      setStatus('cancelled')
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <p className="text-sm text-foreground">{copy.title}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{copy.body}</p>
      </div>

      {status === 'approved' && (
        <Link
          href={`/app/legacy/${deceasedUserId}`}
          className="inline-flex items-center bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-xs font-medium hover:opacity-90 transition-opacity"
        >
          Open their legacy →
        </Link>
      )}

      {isOpen && (
        <>
          {/* Documents */}
          <div className="space-y-3">
            <p className="text-label">Identity &amp; relationship evidence</p>
            {documents.length > 0 && (
              <ul className="space-y-1.5">
                {documents.map((d) => (
                  <li key={d.id} className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                    {DOC_LABEL[d.type] ?? d.type}
                    <span className="text-muted-foreground/60">· {new Date(d.uploaded_at).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-2">
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as RepDocumentType)}
                className="bg-input border border-border rounded-md px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                {uploading ? 'Uploading…' : '+ Add document'}
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={handleUpload}
              className="sr-only"
            />
            <p className="text-[10px] text-muted-foreground">PDF, JPEG, PNG or WebP · max 10 MB · no formal legal documents required</p>
          </div>

          {/* Attestation */}
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={attested}
              onChange={(e) => setAttested(e.target.checked)}
              className="mt-0.5 accent-foreground"
            />
            <span className="text-xs text-muted-foreground leading-relaxed">
              I attest that I am authorized to access this person&rsquo;s records, that the
              information I&rsquo;ve provided is true, and that I will not impersonate them.
              I understand all access is logged.
            </span>
          </label>

          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleCancel}
              disabled={pending}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              Cancel request
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending || !attested}
              className="bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity ml-auto"
            >
              {pending ? 'Submitting…' : 'Submit for verification'}
            </button>
          </div>
        </>
      )}

      {error && !isOpen && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
