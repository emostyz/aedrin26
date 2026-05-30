'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import type { Domain } from '@/lib/supabase/types'

interface Chapter {
  domain: Domain
  label: string
  tagline: string
  narrative: string | null
  entries: { id: string; content: string; created_at: string }[]
  wordCount: number
}

interface Props {
  authorName: string
  chapters: Chapter[]
  totalWords: number
  totalEntries: number
  startYear: number
}

const DOMAIN_ROMAN: Record<Domain, string> = {
  childhood: 'I', family: 'II', career: 'III', values: 'IV',
  beliefs: 'V', lessons: 'VI', messages: 'VII', other: 'VIII',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function PrintMemoir({ authorName, chapters, totalWords, totalEntries, startYear }: Props) {
  // Auto-trigger print dialog if ?print=1 is in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('print') === '1') {
      setTimeout(() => window.print(), 400)
    }
  }, [])

  const currentYear = new Date().getFullYear()
  const yearRange = startYear === currentYear ? `${startYear}` : `${startYear}–${currentYear}`

  return (
    <>
      {/* ── Screen chrome ─────────────────────────────────────────────────── */}
      <div className="print:hidden space-y-6 mb-10">
        <div className="space-y-1">
          <p className="text-label">Print / Save as PDF</p>
          <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
            {authorName}&apos;s memoir.
          </p>
          <p className="text-sm text-muted-foreground">
            {totalEntries.toLocaleString()} memories · {totalWords.toLocaleString()} words · {chapters.length} chapters
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => window.print()}
            className="bg-foreground text-background rounded-lg px-5 py-2.5 text-sm font-light hover:opacity-90 transition-opacity"
          >
            Save as PDF
          </button>
          <Link
            href="/app/memoir"
            className="border border-border rounded-lg px-5 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to memoir
          </Link>
        </div>

        <div className="border border-border/60 rounded-xl px-5 py-4 space-y-2 max-w-lg">
          <p className="text-xs font-medium text-foreground">How to save as PDF</p>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Click &ldquo;Save as PDF&rdquo; above</li>
            <li>In the print dialog, choose your printer as &ldquo;Save as PDF&rdquo; or &ldquo;Microsoft Print to PDF&rdquo;</li>
            <li>Set paper size to A4 or Letter; check &ldquo;Background graphics&rdquo; for best results</li>
            <li>Click Save</li>
          </ol>
        </div>

        <p className="text-xs text-muted-foreground/60">
          Private entries are included. This is your personal copy — share only what you choose.
        </p>
      </div>

      {/* ── Print document ────────────────────────────────────────────────── */}
      <div className="memoir-print-body font-serif">

        {/* Cover page */}
        <div className="print-page cover-page">
          <div className="cover-inner">
            <p className="cover-label">A memoir</p>
            <h1 className="cover-title">{authorName}</h1>
            <p className="cover-years">{yearRange}</p>
            <div className="cover-rule" />
            <p className="cover-stats">
              {totalEntries.toLocaleString()} memories &middot; {totalWords.toLocaleString()} words &middot; {chapters.length} chapters
            </p>
            <p className="cover-footer">
              Written and preserved on AEDRIN
            </p>
          </div>
        </div>

        {/* Table of contents */}
        <div className="print-page toc-page">
          <h2 className="toc-heading">Contents</h2>
          <ol className="toc-list">
            {chapters.map((ch, idx) => (
              <li key={ch.domain} className="toc-item">
                <span className="toc-roman">{DOMAIN_ROMAN[ch.domain]}</span>
                <span className="toc-chapter-name">{ch.label}</span>
                <span className="toc-dots" />
                <span className="toc-count">{ch.entries.length} {ch.entries.length === 1 ? 'entry' : 'entries'}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Chapters */}
        {chapters.map((ch, chIdx) => (
          <div key={ch.domain}>
            {/* Chapter title page */}
            <div className="print-page chapter-title-page">
              <p className="chapter-num">{DOMAIN_ROMAN[ch.domain]}</p>
              <h2 className="chapter-heading">{ch.label}</h2>
              <p className="chapter-tagline">{ch.tagline}</p>
              <p className="chapter-meta">{ch.wordCount.toLocaleString()} words · {ch.entries.length} {ch.entries.length === 1 ? 'entry' : 'entries'}</p>

              {/* AI narrative if available */}
              {ch.narrative && (
                <div className="chapter-narrative">
                  <p className="narrative-label">Chapter overview</p>
                  <p className="narrative-text">{ch.narrative}</p>
                </div>
              )}
            </div>

            {/* Entries */}
            {ch.entries.map((entry, eIdx) => (
              <div key={entry.id} className="print-page entry-page">
                <p className="entry-date">{formatDate(entry.created_at)}</p>
                <p className="entry-num">{ch.label} · Entry {eIdx + 1}</p>
                <div className="entry-rule" />
                <p className="entry-content">{entry.content}</p>
                <p className="entry-word-count">{wordCount(entry.content)} words</p>
              </div>
            ))}
          </div>
        ))}

        {/* Closing page */}
        <div className="print-page closing-page">
          <div className="closing-inner">
            <div className="closing-rule" />
            <p className="closing-text">
              These are the words {authorName} chose to leave behind.
            </p>
            <p className="closing-sub">
              Preserved on AEDRIN · aedrin.com
            </p>
          </div>
        </div>
      </div>

      {/* ── Print CSS ─────────────────────────────────────────────────────── */}
      <style>{`
        /* ─── Screen preview ─── */
        .memoir-print-body {
          max-width: 700px;
          margin: 0 auto;
        }

        .print-page {
          border: 1px solid hsl(var(--border));
          border-radius: 12px;
          margin-bottom: 24px;
          padding: 64px 72px;
          min-height: 600px;
          background: hsl(var(--background));
          position: relative;
        }

        /* Cover */
        .cover-page { display: flex; align-items: center; justify-content: center; text-align: center; }
        .cover-inner { display: flex; flex-direction: column; align-items: center; gap: 16px; max-width: 400px; }
        .cover-label { font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: hsl(var(--muted-foreground)); margin: 0; }
        .cover-title { font-size: 2.8rem; font-weight: 300; letter-spacing: -0.04em; line-height: 1.1; color: hsl(var(--foreground)); margin: 0; font-family: Georgia, serif; }
        .cover-years { font-size: 14px; color: hsl(var(--muted-foreground)); margin: 0; }
        .cover-rule { width: 40px; height: 1px; background: hsl(var(--border)); }
        .cover-stats { font-size: 12px; color: hsl(var(--muted-foreground)); margin: 0; }
        .cover-footer { font-size: 10px; color: hsl(var(--muted-foreground) / 0.5); margin: 0; position: absolute; bottom: 40px; left: 0; right: 0; text-align: center; }

        /* TOC */
        .toc-page { min-height: 400px; }
        .toc-heading { font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: hsl(var(--muted-foreground)); margin: 0 0 32px; font-weight: 400; }
        .toc-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
        .toc-item { display: flex; align-items: baseline; gap: 10px; font-size: 14px; }
        .toc-roman { font-size: 11px; color: hsl(var(--muted-foreground) / 0.6); width: 28px; flex-shrink: 0; }
        .toc-chapter-name { color: hsl(var(--foreground)); font-weight: 300; }
        .toc-dots { flex: 1; border-bottom: 1px dotted hsl(var(--border)); margin-bottom: 3px; }
        .toc-count { font-size: 12px; color: hsl(var(--muted-foreground)); flex-shrink: 0; }

        /* Chapter title */
        .chapter-title-page { min-height: 400px; }
        .chapter-num { font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: hsl(var(--muted-foreground) / 0.6); margin: 0 0 12px; }
        .chapter-heading { font-size: 2.2rem; font-weight: 300; letter-spacing: -0.03em; color: hsl(var(--foreground)); margin: 0 0 8px; font-family: Georgia, serif; }
        .chapter-tagline { font-size: 15px; color: hsl(var(--muted-foreground)); font-style: italic; margin: 0 0 24px; }
        .chapter-meta { font-size: 11px; color: hsl(var(--muted-foreground) / 0.6); margin: 0 0 32px; }
        .chapter-narrative { border-top: 1px solid hsl(var(--border)); padding-top: 28px; }
        .narrative-label { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: hsl(var(--muted-foreground) / 0.5); margin: 0 0 12px; }
        .narrative-text { font-size: 15px; line-height: 1.85; color: hsl(var(--foreground) / 0.85); font-style: italic; margin: 0; }

        /* Entries */
        .entry-page { padding: 48px 72px; }
        .entry-date { font-size: 11px; letter-spacing: 0.1em; color: hsl(var(--muted-foreground) / 0.6); margin: 0 0 4px; text-transform: uppercase; }
        .entry-num { font-size: 11px; color: hsl(var(--muted-foreground) / 0.4); margin: 0 0 16px; }
        .entry-rule { width: 32px; height: 1px; background: hsl(var(--border)); margin-bottom: 20px; }
        .entry-content { font-size: 15px; line-height: 1.95; color: hsl(var(--foreground) / 0.9); white-space: pre-wrap; margin: 0 0 20px; font-weight: 300; }
        .entry-word-count { font-size: 10px; color: hsl(var(--muted-foreground) / 0.4); margin: 0; }

        /* Closing */
        .closing-page { display: flex; align-items: center; justify-content: center; text-align: center; }
        .closing-inner { display: flex; flex-direction: column; align-items: center; gap: 16px; }
        .closing-rule { width: 40px; height: 1px; background: hsl(var(--border)); }
        .closing-text { font-size: 16px; font-style: italic; color: hsl(var(--foreground) / 0.7); margin: 0; font-weight: 300; max-width: 300px; line-height: 1.7; }
        .closing-sub { font-size: 10px; color: hsl(var(--muted-foreground) / 0.4); margin: 0; letter-spacing: 0.1em; }

        /* ─── Print media ─── */
        @media print {
          .print\\:hidden { display: none !important; }
          .memoir-print-body { max-width: none; margin: 0; }

          .print-page {
            border: none;
            border-radius: 0;
            margin-bottom: 0;
            padding: 72px 88px;
            min-height: auto;
            page-break-after: always;
            break-after: page;
          }

          /* Last page — no extra break */
          .closing-page { page-break-after: avoid; break-after: avoid; }

          /* Each entry on its own page (long entries especially) */
          .entry-page {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          /* Chapter title never orphaned */
          .chapter-title-page {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .cover-title { font-size: 48pt; }
          .chapter-heading { font-size: 32pt; }
          .entry-content { font-size: 12pt; line-height: 1.9; }
          .narrative-text { font-size: 11pt; }

          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </>
  )
}
