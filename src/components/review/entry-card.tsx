'use client'

import { useTransition } from 'react'
import { updateSharingStatus } from '@/app/actions/entries'
import type { Database, SharingStatus } from '@/lib/supabase/types'

type Entry = Database['public']['Tables']['soul_entries']['Row']

interface Props {
  entry: Entry
}

export function EntryCard({ entry }: Props) {
  const [isPending, startTransition] = useTransition()
  const isShareable = entry.sharing_status === 'shareable'

  function toggle() {
    const next: SharingStatus = isShareable ? 'private' : 'shareable'
    startTransition(async () => {
      await updateSharingStatus(entry.id, next)
    })
  }

  return (
    <div className="rounded-lg border border-border px-5 py-4 space-y-3">
      <p className="text-sm text-foreground leading-relaxed">{entry.content}</p>

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          {new Date(entry.created_at).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>

        <button
          onClick={toggle}
          disabled={isPending}
          aria-label={isShareable ? 'Mark as private' : 'Mark as shareable'}
          className={[
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50',
            isShareable
              ? 'bg-foreground/10 text-foreground hover:bg-foreground/20'
              : 'bg-muted text-muted-foreground hover:bg-muted/80',
          ].join(' ')}
        >
          <span
            className={[
              'inline-block w-1.5 h-1.5 rounded-full',
              isShareable ? 'bg-foreground' : 'bg-muted-foreground',
            ].join(' ')}
          />
          {isPending ? '…' : isShareable ? 'Shareable' : 'Private'}
        </button>
      </div>
    </div>
  )
}
