'use client'

import { useState, useTransition } from 'react'
import { initiateMemorialization, submitVerificationDocuments } from '@/app/actions/memorialization'

type Step = 'initiate' | 'upload' | 'done'

interface Props {
  userEmail: string
}

export function ExecutorFlow({ userEmail }: Props) {
  const [step, setStep] = useState<Step>('initiate')
  const [requestId, setRequestId] = useState<string | null>(null)
  const [deceasedName, setDeceasedName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; url: string; type: string }[]>([])

  function handleInitiate(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await initiateMemorialization(formData)
      if (result?.error) { setError(result.error); return }
      setRequestId(result.requestId!)
      setDeceasedName(result.deceasedName!)
      setStep('upload')
    })
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !requestId) return
    setError(null)

    const reader = new FileReader()
    reader.onload = async () => {
      // Upload to Supabase Storage via API route (service role required)
      const res = await fetch('/api/memorialization/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          fileName: file.name,
          fileType: file.type,
          fileData: (reader.result as string).split(',')[1], // base64
        }),
      })
      const json = await res.json()
      if (json.error) { setError(json.error); return }
      setUploadedFiles((prev) => [...prev, { name: file.name, url: json.url, type: file.type }])
    }
    reader.readAsDataURL(file)
  }

  function handleSubmitDocs() {
    if (!requestId || uploadedFiles.length === 0) return
    setError(null)
    startTransition(async () => {
      const result = await submitVerificationDocuments(requestId, uploadedFiles)
      if (result?.error) { setError(result.error); return }
      setStep('done')
    })
  }

  if (step === 'done') {
    return (
      <div className="space-y-4 rounded-lg border border-border px-6 py-6">
        <p className="text-sm font-medium text-foreground">Documents submitted.</p>
        <p className="text-sm text-muted-foreground">
          A mandatory 30-day grace period has begun. {deceasedName ? `${deceasedName}'s` : 'The'} account
          holder may cancel this request during that time. After the grace period, the request will
          go to human review before legacy access is granted to heirs.
        </p>
      </div>
    )
  }

  if (step === 'upload') {
    return (
      <div className="space-y-6 rounded-lg border border-border px-6 py-6">
        <div>
          <p className="text-sm font-medium text-foreground">
            Request initiated for {deceasedName}.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Upload documentation (death certificate or equivalent). Accepted formats: PDF, JPEG, PNG, WebP. Max 10 MB each.
          </p>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-foreground">Upload document</span>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileUpload}
              className="mt-1 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium"
            />
          </label>

          {uploadedFiles.length > 0 && (
            <ul className="space-y-1">
              {uploadedFiles.map((f) => (
                <li key={f.url} className="text-xs text-muted-foreground">
                  ✓ {f.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <button
          onClick={handleSubmitDocs}
          disabled={isPending || uploadedFiles.length === 0}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Submitting…' : 'Submit documents and begin grace period'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border px-6 py-4 space-y-1">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">You are logged in as</p>
        <p className="text-sm text-foreground">{userEmail}</p>
        <p className="text-xs text-muted-foreground mt-1">
          You may initiate a memorialization request only for accounts that have designated your email as executor.
        </p>
      </div>

      <form action={handleInitiate} className="space-y-4 rounded-lg border border-border px-6 py-5">
        <div className="space-y-1.5">
          <label htmlFor="target-email" className="text-sm font-medium text-foreground">
            Account holder's email address
          </label>
          <input
            id="target-email"
            name="target_email"
            type="email"
            required
            placeholder="their@email.com"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Checking…' : 'Initiate memorialization request'}
        </button>
      </form>
    </div>
  )
}
