import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PrintMemoir } from '@/components/memoir/print-memoir'
import type { Domain } from '@/lib/supabase/types'

const CHAPTER_ORDER: Domain[] = ['childhood', 'family', 'career', 'values', 'beliefs', 'lessons', 'messages', 'other']

const CHAPTER_META: Record<Domain, { label: string; tagline: string }> = {
  childhood: { label: 'Childhood',  tagline: 'Where it all began.'              },
  family:    { label: 'Family',     tagline: 'The people who shaped you.'        },
  career:    { label: 'Career',     tagline: 'What you built and learned.'       },
  values:    { label: 'Values',     tagline: 'What you believe and why.'         },
  beliefs:   { label: 'Beliefs',    tagline: 'How you understand the world.'     },
  lessons:   { label: 'Lessons',    tagline: 'What you would pass on.'           },
  messages:  { label: 'Messages',   tagline: 'Things you want said.'             },
  other:     { label: 'Other',      tagline: 'Everything else that matters.'     },
}

export default async function PrintMemoirPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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
      .select('display_name, legal_name, created_at, dob')
      .eq('id', user.id)
      .single(),
  ])

  const entries = (entriesData ?? []) as { id: string; domain: Domain; content: string; created_at: string }[]

  if (entries.length === 0) redirect('/app/memoir')

  // Latest narrative per domain
  const narrativeByDomain: Record<string, string> = {}
  for (const n of (narrativesData ?? []) as { domain: string; content: string; created_at: string }[]) {
    if (!narrativeByDomain[n.domain]) narrativeByDomain[n.domain] = n.content
  }

  const profile = profileData as {
    display_name: string | null; legal_name: string; created_at: string; dob: string | null
  } | null

  const authorName = profile?.display_name ?? profile?.legal_name ?? 'The Author'
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).getFullYear()
    : new Date().getFullYear()

  // Build chapters (only domains with entries)
  const chapters = CHAPTER_ORDER
    .map((domain) => {
      const domainEntries = entries.filter((e) => e.domain === domain)
      if (domainEntries.length === 0) return null
      const meta = CHAPTER_META[domain]
      const wordCount = domainEntries.reduce(
        (sum, e) => sum + e.content.trim().split(/\s+/).filter(Boolean).length, 0
      )
      return {
        domain,
        label: meta.label,
        tagline: meta.tagline,
        narrative: narrativeByDomain[domain] ?? null,
        entries: domainEntries,
        wordCount,
      }
    })
    .filter(Boolean) as Array<{
      domain: Domain
      label: string
      tagline: string
      narrative: string | null
      entries: { id: string; content: string; created_at: string }[]
      wordCount: number
    }>

  const totalWords = entries.reduce(
    (sum, e) => sum + e.content.trim().split(/\s+/).filter(Boolean).length, 0
  )
  const startYear = entries[0] ? new Date(entries[0].created_at).getFullYear() : memberSince

  return (
    <PrintMemoir
      authorName={authorName}
      chapters={chapters}
      totalWords={totalWords}
      totalEntries={entries.length}
      startYear={startYear}
    />
  )
}
