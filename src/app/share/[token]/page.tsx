import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyShareToken } from '@/lib/share-token'
import type { Domain } from '@/lib/supabase/types'

const DOMAIN_LABELS: Record<Domain, string> = {
  childhood: 'Childhood', family: 'Family', career: 'Career',
  values: 'Values', beliefs: 'Beliefs', lessons: 'Lessons',
  messages: 'Messages', other: 'Other',
}

const DOMAIN_ACCENT: Record<Domain, string> = {
  childhood: 'border-amber-500/30 bg-amber-500/5',
  family:    'border-rose-500/30 bg-rose-500/5',
  career:    'border-blue-500/30 bg-blue-500/5',
  values:    'border-emerald-500/30 bg-emerald-500/5',
  beliefs:   'border-violet-500/30 bg-violet-500/5',
  lessons:   'border-orange-500/30 bg-orange-500/5',
  messages:  'border-teal-500/30 bg-teal-500/5',
  other:     'border-border/40 bg-surface/20',
}

const DOMAIN_DOT: Record<Domain, string> = {
  childhood: 'bg-amber-400',
  family:    'bg-rose-400',
  career:    'bg-blue-400',
  values:    'bg-emerald-400',
  beliefs:   'bg-violet-400',
  lessons:   'bg-orange-400',
  messages:  'bg-teal-400',
  other:     'bg-muted-foreground',
}

interface Props {
  params: Promise<{ token: string }>
}

export default async function SharedMemoryPage({ params }: Props) {
  const { token } = await params

  // Verify token
  const claims = verifyShareToken(token)
  if (!claims) notFound()

  // Fetch entry using service client (bypass RLS — we verified via signed token)
  const service = createServiceClient()

  const [{ data: entryData }, { data: authorData }] = await Promise.all([
    service
      .from('soul_entries')
      .select('id, user_id, domain, content, created_at, bound_recipient_id')
      .eq('id', claims.e)
      .eq('user_id', claims.u)  // Ownership verified via both token claim AND DB
      .single(),
    service
      .from('users')
      .select('display_name, legal_name')
      .eq('id', claims.u)
      .single(),
  ])

  if (!entryData) notFound()
  if (entryData.bound_recipient_id) notFound() // Never share final letters publicly

  const entry = entryData as {
    id: string; user_id: string; domain: Domain; content: string;
    created_at: string; bound_recipient_id: string | null
  }
  const author = authorData as { display_name: string | null; legal_name: string } | null
  const authorName = author?.display_name ?? author?.legal_name ?? 'Someone'
  const domain = entry.domain as Domain

  const wordCount = entry.content.trim().split(/\s+/).filter(Boolean).length
  const date = new Date(entry.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Minimal header */}
      <header className="border-b border-border/40 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-sm font-medium tracking-[0.08em] text-foreground">
          AEDRIN
        </Link>
        <span className="text-xs text-muted-foreground">A shared memory</span>
      </header>

      {/* Content */}
      <main className="flex-1 mx-auto w-full max-w-2xl px-6 py-12 space-y-8">
        {/* Attribution */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground/60 uppercase tracking-wider">
            {authorName} shared a memory
          </p>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${DOMAIN_DOT[domain]}`} />
            <p className="text-xs text-muted-foreground">{DOMAIN_LABELS[domain]}</p>
            <span className="text-muted-foreground/30">·</span>
            <p className="text-xs text-muted-foreground/60">{date}</p>
            <span className="text-muted-foreground/30">·</span>
            <p className="text-xs text-muted-foreground/60">{wordCount} words</p>
          </div>
        </div>

        {/* The memory */}
        <div className={`border rounded-2xl px-8 py-8 ${DOMAIN_ACCENT[domain]}`}>
          <p className="text-[1.05rem] font-light leading-[1.95] text-foreground/90 whitespace-pre-wrap">
            {entry.content}
          </p>
        </div>

        {/* Footer CTA */}
        <div className="border border-border/40 rounded-xl px-6 py-5 space-y-3 text-center">
          <p className="text-sm text-foreground font-light">Preserve your own story.</p>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
            AEDRIN helps you capture your life's memories so the people you love can carry them forward.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-foreground text-background rounded-lg px-5 py-2.5 text-sm font-light hover:opacity-90 transition-opacity mt-2"
          >
            Start your memoir →
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 px-6 py-4 text-center">
        <p className="text-[10px] text-muted-foreground/40">
          This link was shared by {authorName} and will expire after 30 days.{' '}
          <Link href="/" className="hover:text-muted-foreground transition-colors">
            aedrin.com
          </Link>
        </p>
      </footer>
    </div>
  )
}
