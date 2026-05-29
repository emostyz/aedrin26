'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'

type Format = 'json' | 'markdown'

const FORMATS: { id: Format; label: string; description: string; ext: string }[] = [
  {
    id: 'json',
    label: 'JSON',
    description: 'Complete structured archive. Import into other apps, process with code, or store as a machine-readable backup.',
    ext: '.json',
  },
  {
    id: 'markdown',
    label: 'Markdown',
    description: 'Human-readable document. Open in any text editor, Obsidian, Notion, or print as PDF. Your story as a book.',
    ext: '.md',
  },
]

export default function ExportPage() {
  const [format, setFormat]         = useState<Format>('markdown')
  const [downloading, setDownloading] = useState(false)
  const [done, setDone]             = useState(false)
  const [error, setError]           = useState<string | null>(null)

  async function handleExport() {
    setDownloading(true)
    setDone(false)
    setError(null)
    try {
      const endpoint = format === 'markdown' ? '/api/export-md' : '/api/export'
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      const ext  = format === 'markdown' ? 'md' : 'json'
      a.download = `aedrin-export-${new Date().toISOString().slice(0, 10)}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
      setDone(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <p className="text-label">Export</p>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          Your data, yours to keep.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
          Download a complete archive of your Soul Profile. Own your story — no lock-in, no dependencies.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: { delay: 0.08 } }}
        className="space-y-6"
      >
        {/* Format selector */}
        <div className="space-y-3">
          <p className="text-label">Choose format</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => { setFormat(f.id); setDone(false) }}
                className={[
                  'text-left border rounded-xl px-5 py-4 space-y-1.5 transition-all duration-200',
                  format === f.id
                    ? 'border-foreground bg-foreground/3'
                    : 'border-border hover:border-foreground/20',
                ].join(' ')}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{f.label}</p>
                  <span className="text-[10px] font-mono text-muted-foreground border border-border/60 rounded px-1.5 py-0.5">{f.ext}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{f.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* What's included */}
        <div className="border border-border/60 rounded-xl px-5 py-5 space-y-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">What&apos;s included</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
            {[
              'All soul entries & memories',
              'Life map events & milestones',
              'Values & beliefs summaries',
              'Final letters (sealed — content private)',
              'Heir & executor records',
              'Custom interview questions',
              'Daily prompts & insights',
              'Profile & life context',
            ].map((item) => (
              <li key={item} className="text-xs text-muted-foreground flex items-start gap-2">
                <span className="text-muted-foreground/30 mt-px shrink-0">—</span>
                {item}
              </li>
            ))}
          </ul>

          {format === 'markdown' && (
            <AnimatePresence>
              <motion.p
                key="md-note"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-[11px] text-muted-foreground/60 border-t border-border/40 pt-3 mt-1"
              >
                The Markdown export is formatted as a readable document — sections, headings, dates. Open it in Obsidian, Notion, Bear, iA Writer, or any notes app. Print to PDF directly from your browser.
              </motion.p>
            </AnimatePresence>
          )}
        </div>

        {/* Download button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleExport}
            disabled={downloading}
            className="bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {downloading ? 'Preparing download…' : `Download ${format === 'markdown' ? 'Markdown' : 'JSON'}`}
          </button>

          {done && (
            <motion.p
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xs text-muted-foreground"
            >
              Downloaded ✓
            </motion.p>
          )}
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-destructive"
            >
              {error}
            </motion.p>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.3 } }}
        className="border-t border-border pt-6 space-y-2"
      >
        <p className="text-xs text-muted-foreground">
          Your data is never sold or shared. Exports are generated on-demand and not stored on our servers.
        </p>
        <p className="text-xs text-muted-foreground">
          To permanently delete your account and all data,{' '}
          <a href="/app/settings/delete" className="underline underline-offset-2 hover:text-foreground transition-colors">
            go to account deletion
          </a>
          .
        </p>
      </motion.div>
    </div>
  )
}
