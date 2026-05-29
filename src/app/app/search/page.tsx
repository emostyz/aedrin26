import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { FadeUp } from '@/components/ui/motion'
import { SearchClient } from '@/components/search/search-client'
import type { Database, Domain } from '@/lib/supabase/types'

type SoulEntry = Database['public']['Tables']['soul_entries']['Row']

export default async function SearchPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('soul_entries')
    .select('*')
    .eq('user_id', user.id)
    .is('bound_recipient_id', null)
    .order('created_at', { ascending: false })

  const entries = (data ?? []) as SoulEntry[]

  // Build prompt-text lookup (same as review page)
  const interviewIds = [...new Set(entries.map((e) => e.prompt_id).filter(Boolean))] as string[]
  const dailyIds     = [...new Set(entries.map((e) => e.daily_prompt_id).filter(Boolean))] as string[]

  const [interviewRes, dailyRes] = await Promise.all([
    interviewIds.length
      ? supabase.from('interview_prompts').select('id, text').in('id', interviewIds)
      : { data: [] },
    dailyIds.length
      ? supabase.from('daily_prompts').select('id, prompt_text').in('id', dailyIds)
      : { data: [] },
  ])

  const interviewMap = Object.fromEntries(
    (interviewRes.data ?? []).map((r: { id: string; text: string }) => [r.id, r.text])
  )
  const dailyMap = Object.fromEntries(
    (dailyRes.data ?? []).map((r: { id: string; prompt_text: string }) => [r.id, r.prompt_text])
  )

  const promptMap = Object.fromEntries(
    entries.map((e) => [
      e.id,
      (e.prompt_id       ? interviewMap[e.prompt_id]       : null) ??
      (e.daily_prompt_id ? dailyMap[e.daily_prompt_id]     : null) ??
      null,
    ])
  ) as Record<string, string | null>

  const domains = [...new Set(entries.map((e) => e.domain))] as Domain[]

  return (
    <div className="space-y-10">
      <FadeUp className="space-y-2">
        <p className="text-label">Search</p>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          Find anything.
        </p>
        <p className="text-xs text-muted-foreground">
          {entries.length === 0
            ? 'No entries yet — start in Capture.'
            : `Across ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}.`}
        </p>
      </FadeUp>

      {entries.length > 0 && (
        <Suspense>
          <SearchClient entries={entries} promptMap={promptMap} domains={domains} />
        </Suspense>
      )}
    </div>
  )
}
