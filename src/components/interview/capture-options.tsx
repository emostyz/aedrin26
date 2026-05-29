'use client'

import { useState } from 'react'
import { AnimatePresence } from '@/components/ui/motion'
import { DeepMemory } from './deep-memory'
import type { Domain } from '@/lib/supabase/types'

interface Props {
  defaultDomain?: Domain
}

export function CaptureOptions({ defaultDomain }: Props) {
  const [showDeep, setShowDeep] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setShowDeep(true)}
        className="group flex items-center justify-between w-full border border-dashed border-border rounded-lg px-5 py-4 hover:border-foreground/20 hover:bg-surface/30 transition-all duration-200 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-foreground/20 group-hover:bg-foreground/40 transition-colors" />
          <div>
            <p className="text-sm text-foreground">Deep memory capture</p>
            <p className="text-xs text-muted-foreground mt-0.5">3 guided questions that produce a much richer memory</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground shrink-0 ml-6 transition-colors">
          Begin →
        </p>
      </button>

      <AnimatePresence>
        {showDeep && (
          <DeepMemory
            initialDomain={defaultDomain}
            onClose={() => setShowDeep(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
