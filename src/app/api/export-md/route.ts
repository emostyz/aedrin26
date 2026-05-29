import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DOMAIN_LABELS: Record<string, string> = {
  childhood: 'Childhood',
  family:    'Family',
  career:    'Career',
  values:    'Values',
  beliefs:   'Beliefs',
  lessons:   'Lessons',
  messages:  'Messages',
  other:     'Other',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [
    { data: profile },
    { data: entries },
    { data: lifeEvents },
    { data: heirs },
    { data: executors },
    { data: valueSummaries },
    { data: customQuestions },
  ] = await Promise.all([
    supabase.from('users').select('legal_name, display_name, dob, email, created_at').eq('id', user.id).single(),
    supabase.from('soul_entries').select('domain, content, sharing_status, bound_recipient_id, created_at').eq('user_id', user.id).order('created_at'),
    supabase.from('life_events').select('title, description, event_date, event_type').eq('user_id', user.id).order('event_date'),
    supabase.from('heirs').select('name, relationship').eq('user_id', user.id),
    supabase.from('executors').select('name').eq('user_id', user.id),
    // value_summaries uses `content` (not `summary`) and `approved_by_user`
    // (not `approved`). The old column names here silently broke the values
    // section of every markdown export.
    supabase.from('value_summaries').select('content, approved_by_user, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
    // Custom questions added by the user — these reflect what THEY chose to
    // wonder about, which is itself a meaningful artifact of who they were.
    supabase.from('custom_questions').select('domain, text, created_at').eq('user_id', user.id).order('created_at'),
  ])

  type ProfileRow  = { legal_name?: string; display_name?: string; dob?: string; email?: string; created_at?: string }
  type EntryRow    = { domain: string; content: string; sharing_status: string; bound_recipient_id: string | null; created_at: string }
  type EventRow    = { title: string; description: string | null; event_date: string; event_type: string }
  type HeirRow     = { name: string; relationship: string }
  type ExecutorRow = { name: string }
  type ValueRow    = { content: string; approved_by_user: boolean; created_at: string }
  type CustomQRow  = { domain: string; text: string; created_at: string }

  const p             = (profile as ProfileRow | null) ?? {}
  const allEntries    = (entries ?? []) as EntryRow[]
  const events        = (lifeEvents ?? []) as EventRow[]
  const heirsList     = (heirs ?? []) as HeirRow[]
  const executorsList = (executors ?? []) as ExecutorRow[]
  const latestValue   = ((valueSummaries ?? []) as ValueRow[])[0]
  const customQs      = (customQuestions ?? []) as CustomQRow[]

  const soulEntries   = allEntries.filter((e) => !e.bound_recipient_id)
  const finalLetters  = allEntries.filter((e) => !!e.bound_recipient_id)

  const name = p.display_name ?? p.legal_name ?? 'Unknown'
  const memberSince = p.created_at ? fmtDate(p.created_at) : 'Unknown'
  const exportDate  = fmtDate(new Date().toISOString())
  const totalWords  = soulEntries.reduce((sum, e) => sum + e.content.trim().split(/\s+/).filter(Boolean).length, 0)

  // Group soul entries by domain
  const byDomain: Record<string, EntryRow[]> = {}
  for (const e of soulEntries) {
    if (!byDomain[e.domain]) byDomain[e.domain] = []
    byDomain[e.domain].push(e)
  }

  const lines: string[] = []

  // ── Header ──────────────────────────────────────────────────────────────
  lines.push(`# ${name}'s Soul Profile`)
  lines.push('')
  lines.push(`*Exported from AEDRIN on ${exportDate}*`)
  lines.push('')
  lines.push(`**${soulEntries.length.toLocaleString()} entries · ${totalWords.toLocaleString()} words · Member since ${memberSince}**`)
  if (heirsList.length > 0) {
    lines.push('')
    lines.push(`*Designated for: ${heirsList.map((h) => `${h.name} (${h.relationship})`).join(', ')}*`)
  }
  if (executorsList.length > 0) {
    lines.push('')
    lines.push(`*Executor${executorsList.length > 1 ? 's' : ''}: ${executorsList.map((e) => e.name).join(', ')}*`)
  }
  lines.push('')
  lines.push('---')
  lines.push('')

  // ── Values summary ───────────────────────────────────────────────────────
  if (latestValue?.content) {
    lines.push('## Core Values')
    lines.push('')
    lines.push(latestValue.content)
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  // ── Life map / timeline ──────────────────────────────────────────────────
  if (events.length > 0) {
    lines.push('## Life Map')
    lines.push('')
    for (const ev of events) {
      const dateStr = ev.event_date ? fmtDate(ev.event_date) : 'Unknown date'
      lines.push(`### ${ev.title}`)
      lines.push(`*${dateStr}*`)
      if (ev.description) {
        lines.push('')
        lines.push(ev.description)
      }
      lines.push('')
    }
    lines.push('---')
    lines.push('')
  }

  // ── Soul entries by domain ────────────────────────────────────────────────
  lines.push('## My Story')
  lines.push('')

  const domainOrder = ['childhood', 'family', 'career', 'values', 'beliefs', 'lessons', 'messages', 'other']
  for (const domain of domainOrder) {
    const domainEntries = byDomain[domain]
    if (!domainEntries?.length) continue

    const label = DOMAIN_LABELS[domain] ?? domain
    lines.push(`### ${label}`)
    lines.push('')

    for (const e of domainEntries) {
      // Bold-italic date instead of an H4 heading — H4 renders as tiny text
      // in browser-PDF prints and breaks the visual hierarchy of the chapter.
      lines.push(`**_${fmtDate(e.created_at)}_**`)
      lines.push('')
      lines.push(e.content)
      lines.push('')
    }
  }

  lines.push('---')
  lines.push('')

  // ── Custom questions the user added ──────────────────────────────────────
  // These are the prompts the user themselves chose to wonder about.
  // Including them adds a layer of self-portraiture — what they cared to ask.
  if (customQs.length > 0) {
    const customByDomain: Record<string, CustomQRow[]> = {}
    for (const q of customQs) {
      if (!customByDomain[q.domain]) customByDomain[q.domain] = []
      customByDomain[q.domain].push(q)
    }

    lines.push('## Questions I Asked Myself')
    lines.push('')
    for (const domain of domainOrder) {
      const qs = customByDomain[domain]
      if (!qs?.length) continue
      const label = DOMAIN_LABELS[domain] ?? domain
      lines.push(`### ${label}`)
      lines.push('')
      for (const q of qs) lines.push(`- ${q.text}`)
      lines.push('')
    }
    lines.push('---')
    lines.push('')
  }

  // ── Final letters (placeholder — content stays sealed) ───────────────────
  // Intentionally kept as a placeholder in the *markdown* (which is meant to
  // be printable / shareable). The JSON export, which is for personal backup,
  // includes the full content. This asymmetry is by design.
  if (finalLetters.length > 0) {
    lines.push('## Final Letters')
    lines.push('')
    lines.push(`*${finalLetters.length} sealed letter${finalLetters.length !== 1 ? 's' : ''} to be delivered after death. Content not included in this printable export — use the JSON export for a personal backup that includes them.*`)
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  lines.push(`*This document was generated by AEDRIN — https://aedrin.com*`)
  lines.push(`*It contains the private memories and reflections of ${name}.*`)

  const markdown = lines.join('\n')
  const fileName = `${name.replace(/\s+/g, '-').toLowerCase()}-soul-profile-${new Date().toISOString().slice(0, 10)}.md`

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
