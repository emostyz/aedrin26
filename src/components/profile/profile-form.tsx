'use client'

import { useActionState, useState, useRef } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { updateProfile } from '@/app/actions/profile'

interface Props {
  legalName: string
  displayName: string
  dob: string
  photoUrl: string | null
}

export function ProfileForm({ legalName, displayName, dob, photoUrl }: Props) {
  const [state, action, isPending]    = useActionState(updateProfile, {})
  const [photo, setPhoto]             = useState<string | null>(photoUrl)
  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef                  = useRef<HTMLInputElement>(null)

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/profile/photo', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.error) { setUploadError(json.error); return }
      setPhoto(json.url)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-8 max-w-sm">
      {/* Avatar */}
      <div className="space-y-3">
        <p className="text-label">Photo</p>
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-full overflow-hidden border border-border bg-surface flex items-center justify-center shrink-0">
            {photo ? (
              <img src={photo} alt="Profile photo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl text-muted-foreground font-light">
                {legalName.charAt(0).toUpperCase()}
              </span>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                <div className="w-4 h-4 border border-foreground/40 border-t-foreground rounded-full animate-spin" />
              </div>
            )}
          </div>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              {uploading ? 'Uploading…' : 'Upload photo'}
            </button>
            <p className="text-[10px] text-muted-foreground">JPEG, PNG or WebP · max 5 MB</p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePhotoChange}
          className="sr-only"
        />
        {uploadError && (
          <p className="text-xs text-destructive">{uploadError}</p>
        )}
      </div>

      {/* Profile fields */}
      <form action={action} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-label">Legal name</label>
          <p className="text-sm text-muted-foreground">{legalName}</p>
          <p className="text-[10px] text-muted-foreground">Legal name cannot be changed after signup.</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="display_name" className="text-label">
            Display name <span className="normal-case font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            id="display_name"
            name="display_name"
            type="text"
            defaultValue={displayName}
            placeholder="How you'd like to be called"
            className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="dob" className="text-label">
            Date of birth <span className="normal-case font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            id="dob"
            name="dob"
            type="date"
            defaultValue={dob}
            className="w-full bg-input border border-border rounded-md px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <AnimatePresence>
          {state?.error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="text-xs text-destructive"
            >
              {state.error}
            </motion.p>
          )}
          {state?.success && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-muted-foreground"
            >
              Saved.
            </motion.p>
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={isPending}
          className="bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  )
}
