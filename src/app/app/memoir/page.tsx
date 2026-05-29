import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FadeUp } from '@/components/ui/motion'
import { MemoirReader } from '@/components/memoir/memoir-reader'
import { MemoirForeword } from '@/components/memoir/memoir-foreword'
import type { Domain } from '@/lib/supabase/types'

const CHAPTER_ORDER: Domain[] = ['childhood', 'family', 'career', 'values', 'beliefs', 'lessons', 'messages', 'other']

const CHAPTER_META: Record<Domain, { label: string; tagline: string; dot: string }> = {
  childhood: { label: 'Childhood',  tagline: 'Where it all began.',              dot: 'bg-amber-400'   },
  family:    { label: 'Family',     tagline: 'The people who shaped you.',        dot: 'bg-rose-400'    },
  career:    { label: 'Career',     tagline: 'What you built and learned.',       dot: 'bg-blue-400'    },
  values:    { label: 'Values',     tagline: 'What you believe and why.',         dot: 'bg-emerald-400' },
  beliefs:   { label: 'Beliefs',    tagline: 'How you understand the world.',     dot: 'bg-violet-400'  },
  lessons:   { label: 'Lessons',    tagline: 'What you would pass on.',           dot: 'bg-orange-400'  },
  messages:  { label: 'Messages',   tagline: 'Things you want said.',             dot: 'bg-teal-400'    },
  other:     { label: 'Other',      tagline: 'Everything else that matters.',     dot: 'bg-muted-foreground' },
}

export default async function MemoirPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch all entries (non-letters) + domain narratives in parallel
  const [{ data: entriesData }, { data: narrativesData }, { data: profileData }] = await Promise.all([
    supabase
      .from('soul_entries')
      .select('id, domain, content, created_at')
      .eq('user_id', user.id)
      .is('bound_recipient_id', null)
      .order('created_at', { ascending: true }),
    supabase
      .from('domain_narratives')
      .select('domain, content, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('users')
      .select('display_name, legal_name, created_at')
      .eq('id', user.id)
      .single(),
  ])

  const entries = (entriesData ?? []) as {
    id: string; domain: Domain; content: string; created_at: string
  }[]

  // Latest narrative per domain (narratives are ordered desc, so first per domain wins)
  const narrativeByDomain = (narrativesData ?? []).reduce<Record<string, { content: string; created_at: string }>>(
    (acc, n) => {
      if (!acc[n.domain]) acc[n.domain] = { content: n.content, created_at: n.created_at }
      return acc
    }, {}
  )

  // Group entries by domain
  const entriesByDomain = entries.reduce<Record<string, typeof entries>>((acc, e) => {
    if (!acc[e.domain]) acc[e.domain] = []
    acc[e.domain].push(e)
    return acc
  }, {})

  // Build chapters — only include domains with at least one entry
  const chapters = CHAPTER_ORDER
    .filter((d) => (entriesByDomain[d] ?? []).length > 0)
    .map((domain) => {
      const domainEntries = entriesByDomain[domain] ?? []
      const narrative = narrativeByDomain[domain] ?? null
      const wordCount = domainEntries.reduce(
        (sum, e) => sum + e.content.trim().split(/\s+/).filter(Boolean).length,
        0
      )
      const meta = CHAPTER_META[domain]
      // For reading: use narrative if available, otherwise show top 3 entries
      const preview = narrative?.content ?? domainEntries.slice(0, 3).map((e) => e.content).join('\n\n')
      return {
        domain,
        label: meta.label,
        tagline: meta.tagline,
        dot: meta.dot,
        narrative: narrative?.content ?? null,
        narrativeDate: narrative?.created_at ?? null,
        entries: domainEntries,
        wordCount,
        preview,
        entryCount: domainEntries.length,
      }
    })

  const totalEntries = entries.length
  const totalWords = entries.reduce(
    (sum, e) => sum + e.content.trim().split(/\s+/).filter(Boolean).length, 0
  )
  const startDate = entries[0]?.created_at ?? null
  const displayName = profileData?.display_name ?? profileData?.legal_name ?? null

  if (totalEntries === 0) {
    return (
      <div className="space-y-8">
        <FadeUp className="space-y-2">
          <p className="text-label">Your memoir</p>
          <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
            Your story, waiting to be told.
          </p>
        </FadeUp>
        <FadeUp delay={0.1}>
          <div className="border border-border rounded-xl px-5 py-14 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Your memoir takes shape as you capture memories.</p>
            <Link href="/app/interview" className="text-sm text-foreground underline underline-offset-4">
              Start capturing →
            </Link>
          </div>
        </FadeUp>
      </div>
    )
  }

  return (
    <div className="space-y-12">
      <FadeUp className="space-y-2">
        <p className="text-label">Your memoir</p>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          {displayName ? `${displayName}'s story.` : 'Your story.'}
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {totalEntries.toLocaleString()} {totalEntries === 1 ? 'memory' : 'memories'} ·{' '}
          {totalWords.toLocaleString()} words ·{' '}
          {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'}
          {startDate ? ` · Writing since ${new Date(startDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` : ''}
        </p>
      </FadeUp>

      {/* Foreword — AI-generated introduction */}
      {totalEntries >= 5 && (
        <FadeUp delay={0.06}>
          <MemoirForeword displayName={displayName} />
        </FadeUp>
      )}

      <FadeUp delay={0.08}>
        <MemoirReader chapters={chapters} />
      </FadeUp>

      <FadeUp delay={0.12}>
        <div className="border-t border-border pt-8 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/app/memoir/people"
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
            >
              People in your story →
            </Link>
          </div>
          <Link
            href="/app/export"
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
          >
            Export as Markdown →
          </Link>
        </div>
        <p className="text-[10px] text-muted-foreground/40">
          AI chapter summaries refresh automatically when you add more memories.
        </p>
      </FadeUp>
    </div>
  )
}
