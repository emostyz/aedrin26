'use client'

import { useState } from 'react'
import { motion } from '@/components/ui/motion'

export default function ExportPage() {
  const [downloading, setDownloading] = useState(false)
  const [done, setDone]               = useState(false)

  async function handleExport() {
    setDownloading(true)
    setDone(false)
    try {
      const res = await fetch('/api/export')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `aedrin-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setDone(true)
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
        <p className="text-sm text-muted-foreground">
          Download a complete JSON archive of your Soul Profile — all entries, life events, values, heirs, and executors.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
        className="border border-border rounded-lg px-5 py-8 space-y-5"
      >
        <div className="space-y-1.5">
          <p className="text-sm text-foreground">What's included</p>
          <ul className="space-y-1">
            {[
              'Profile information',
              'All soul entries (typed, voice, uploaded)',
              'Life map events',
              'Values summaries',
              'Heir and executor records',
            ].map((item) => (
              <li key={item} className="text-xs text-muted-foreground">
                — {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            The file is a plain JSON document. You can open it with any text editor or import it into other tools.
          </p>
        </div>

        <button
          onClick={handleExport}
          disabled={downloading}
          className="bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {downloading ? 'Preparing download…' : 'Download JSON export'}
        </button>

        {done && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-muted-foreground"
          >
            Downloaded.
          </motion.p>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.25 } }}
        className="border-t border-border pt-6"
      >
        <p className="text-xs text-muted-foreground leading-relaxed">
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
