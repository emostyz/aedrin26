'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'

const SHORTCUTS = [
  { keys: ['N'],          description: 'Quick capture — add an entry from anywhere' },
  { keys: ['⌘', 'K'],    description: 'Search all entries' },
  { keys: ['?'],          description: 'Show this help' },
  { keys: ['Esc'],        description: 'Close modals / clear search' },
  { keys: ['⌘', '↵'],    description: 'Save when editing (in entry forms)' },
]

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (open && e.key === 'Escape') { setOpen(false); return }
      if (open) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '?') { e.preventDefault(); setOpen(true) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none"
          >
            <div className="pointer-events-auto bg-background border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
                <p className="text-sm font-medium text-foreground">Keyboard shortcuts</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1"
                  aria-label="Close"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <ul className="px-5 py-4 space-y-3">
                {SHORTCUTS.map(({ keys, description }) => (
                  <li key={description} className="flex items-center justify-between gap-4">
                    <span className="text-xs text-muted-foreground leading-snug">{description}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {keys.map((k, i) => (
                        <span key={i} className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded border border-border bg-muted text-[10px] font-mono text-muted-foreground">
                          {k}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="px-5 py-3 border-t border-border/40">
                <p className="text-[10px] text-muted-foreground/50">
                  Shortcuts are inactive when typing in a field.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent hint in bottom-left corner (desktop only, fades on hover) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Keyboard shortcuts"
        aria-label="Show keyboard shortcuts"
        className="hidden md:flex fixed bottom-8 left-8 z-30 items-center justify-center w-6 h-6 rounded border border-border/60 bg-background/80 text-[10px] font-mono text-muted-foreground/50 hover:text-foreground hover:border-foreground/20 transition-all duration-150 backdrop-blur-sm"
      >
        ?
      </button>
    </>
  )
}
