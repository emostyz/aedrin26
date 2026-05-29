'use client'

import { useState } from 'react'
import { FadeUp } from '@/components/ui/motion'
import type { Domain } from '@/lib/supabase/types'

export interface OnThisDayEntry {
  id: string
  domain: Domain
  content: string
  created_at: string
}

interface Props {
  entries: OnThisDayEntry[]
}

const DOMAIN_ACCENT: Record<Domain, string> = {
  childhood: 'border-l-amber-500/40',
  family:    'border-l-rose-500/40',
  career:    'border-l-blue-500/40',
  values:    'border-l-emerald-500/40',
  beliefs:   'border-l-violet-500/40',
  lessons:   'border-l-orange-500/40',
  messages:  'border-l-teal-500/40',
  other:     'border-l-border',
}

function EntryCard({ entry }: { entry: OnThisDayEntry }) {
  const [expanded, setExpanded] = useState(false)
  const LIMIT = 200
  const isLong = entry.content.length > LIMIT
  const displayContent = expanded || !isLong
    ? entry.content
    : entry.content.slice(0, LIMIT) + '…'

  const yearsAgo = new Date().getFullYear() - new Date(entry.created_at).getFullYear()
  const yearsLabel = yearsAgo === 1 ? '1 year ago' : `${yearsAgo} years ago`
  const domainLabel = entry.domain.charAt(0).toUpperCase() + entry.domain.slice(1)

  return (
    <div
      className={`border border-border/60 border-l-4 ${DOMAIN_ACCENT[entry.domain]} rounded-xl px-5 py-4 space-y-2 bg-surface/20`}
    >
      <p className="text-sm text-foreground/75 leading-relaxed font-light">
        {displayContent}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
      <p className="text-[10px] text-muted-foreground/50">
        {yearsLabel} · {domainLabel}
      </p>
    </div>
  )
}

export function OnThisDay({ entries }: Props) {
  if (entries.length === 0) return null

  return (
    <FadeUp>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          {/* Calendar icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground/50 shrink-0"
            aria-hidden
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <p className="text-label shrink-0">On this day</p>
          <div className="flex-1 h-px bg-border/60" />
          <span className="text-[10px] text-muted-foreground/50 shrink-0">
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
          </span>
        </div>
        <div className="space-y-2">
          {entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      </div>
    </FadeUp>
  )
}
