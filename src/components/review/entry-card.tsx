'use client'

import { useTransition } from 'react'
import { motion } from '@/components/ui/motion'
import { updateSharingStatus } from '@/app/actions/entries'
import type { Database, SharingStatus } from '@/lib/supabase/types'

type Entry = Database['public']['Tables']['soul_entries']['Row']

export function EntryCard({ entry }: { entry: Entry }) {
  const [isPending, startTransition] = useTransition()
  const isShareable = entry.sharing_status === 'shareable'

  function toggle() {
    startTransition(async () => {
      await updateSharingStatus(entry.id, isShareable ? 'private' : 'shareable')
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border rounded-lg px-5 py-4 space-y-3 hover:border-foreground/10 transition-colors"
    >
      <p className="text-sm text-foreground leading-relaxed">{entry.content}</p>

      {entry.media_url && (
        <a href={entry.media_url} target="_blank" rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ↑ Attachment
        </a>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          {new Date(entry.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <button
          onClick={toggle}
          disabled={isPending}
          aria-pressed={isShareable}
          className={`text-xs px-3 py-1 rounded-full border transition-all disabled:opacity-40 ${
            isShareable
              ? 'border-foreground/30 text-foreground bg-foreground/5'
              : 'border-border text-muted-foreground hover:border-foreground/20'
          }`}
        >
          {isPending ? '…' : isShareable ? 'Shareable' : 'Private'}
        </button>
      </div>
    </motion.div>
  )
}
