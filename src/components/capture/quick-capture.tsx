'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { saveEntry } from '@/app/actions/entries'
import type { Domain } from '@/lib/supabase/types'

const VALID_DOMAINS = new Set(['childhood','family','career','values','beliefs','lessons','messages','other'])

function domainFromPath(pathname: string): Domain {
  // e.g. /app/interview/family → 'family'
  const match = pathname.match(/\/app\/interview\/([^/]+)/)
  if (match && VALID_DOMAINS.has(match[1])) return match[1] as Domain
  return 'other'
}

const DOMAINS: { value: Domain; label: string; color: string }[] = [
  { value: 'childhood', label: 'Childhood', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  { value: 'family',    label: 'Family',    color: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30' },
  { value: 'career',    label: 'Career',    color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30' },
  { value: 'values',    label: 'Values',    color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
  { value: 'beliefs',   label: 'Beliefs',   color: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30' },
  { value: 'lessons',   label: 'Lessons',   color: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30' },
  { value: 'messages',  label: 'Messages',  color: 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30' },
  { value: 'other',     label: 'Other',     color: 'bg-muted text-muted-foreground border-border' },
]

export function QuickCapture() {
  const pathname                    = usePathname()
  const [open, setOpen]             = useState(false)
  const [domain, setDomain]         = useState<Domain>('other')
  const [content, setContent]       = useState('')
  const [error, setError]           = useState<string | null>(null)
  const [savedBrief, setSavedBrief] = useState(false)
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Open with keyboard shortcut N (when not in an input)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (open && e.key === 'Escape') { closeModal(); return }
      if (open) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openModal() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function openModal() {
    // Pre-select the domain matching the current page (if on an interview domain page)
    setDomain(domainFromPath(pathname))
    setOpen(true)
    setTimeout(() => textareaRef.current?.focus(), 80)
  }

  function closeModal() {
    setOpen(false)
    // Reset after animation completes
    setTimeout(() => { setContent(''); setError(null); setSavedBrief(false) }, 250)
  }

  function handleSave() {
    if (!content.trim() || isPending) return
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('domain', domain)
      fd.set('content', content)
      const result = await saveEntry(fd)
      if (result?.error) { setError(result.error); return }
      setSavedBrief(true)
      setContent('')
      setTimeout(() => {
        setSavedBrief(false)
        closeModal()
      }, 1200)
    })
  }

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
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
            onClick={closeModal}
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed bottom-24 left-4 right-4 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg z-50"
          >
            <div className="bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
                <p className="text-sm font-medium text-foreground">Capture a memory</p>
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1"
                  aria-label="Close"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="px-5 py-5 space-y-4">
                {/* Domain picker */}
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Topic</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DOMAINS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setDomain(d.value)}
                        className={[
                          'px-2.5 py-1 rounded-full text-[11px] border transition-all duration-150',
                          domain === d.value
                            ? d.color + ' font-medium'
                            : 'border-border text-muted-foreground hover:border-foreground/20',
                        ].join(' ')}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Textarea */}
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => {
                      setContent(e.target.value)
                      e.target.style.height = 'auto'
                      e.target.style.height = `${e.target.scrollHeight}px`
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
                    }}
                    placeholder="What do you want to remember?"
                    rows={4}
                    className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none leading-relaxed"
                    style={{ minHeight: '100px', maxHeight: '260px', overflowY: 'auto' }}
                  />
                  {content.trim() && (
                    <span className="absolute bottom-2.5 right-3 text-[10px] text-muted-foreground/40 select-none pointer-events-none">
                      {content.trim().split(/\s+/).filter(Boolean).length}w
                    </span>
                  )}
                </div>

                {error && (
                  <p role="alert" className="text-xs text-destructive">{error}</p>
                )}

                <AnimatePresence>
                  {savedBrief && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-xs text-muted-foreground"
                    >
                      Saved. ✓
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-muted-foreground/40">⌘↵ to save · Esc to close</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={!content.trim() || isPending}
                      className="bg-primary text-primary-foreground rounded-lg px-4 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
                    >
                      {isPending ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.18 }}
            type="button"
            onClick={openModal}
            title="Quick capture (N)"
            aria-label="Quick capture"
            className="fixed bottom-[5.5rem] right-5 md:bottom-8 md:right-8 z-30 w-12 h-12 rounded-full bg-foreground text-background shadow-lg flex items-center justify-center hover:opacity-90 active:scale-95 transition-all duration-150"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  )
}
