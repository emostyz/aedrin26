import { createClient } from '@/lib/supabase/server'
import { FadeUp } from '@/components/ui/motion'
import { ReviewClient } from '@/components/review/review-client'
import type { Database, Domain } from '@/lib/supabase/types'

type SoulEntry = Database['public']['Tables']['soul_entries']['Row']

export default async function ReviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('soul_entries')
    .select('*')
    .eq('user_id', user.id)
    .is('bound_recipient_id', null)   // exclude final letters — they live in /app/letters
    .order('created_at', { ascending: false })

  if (error) return (
    <div className="border border-border rounded-lg px-5 py-10 text-center">
      <p className="text-sm text-destructive">Failed to load. Please try again.</p>
    </div>
  )

  const entries = (data ?? []) as SoulEntry[]

  // Collect unique prompt IDs so we can fetch their text
  const interviewIds  = [...new Set(entries.map((e) => e.prompt_id).filter(Boolean))] as string[]
  const dailyIds      = [...new Set(entries.map((e) => e.daily_prompt_id).filter(Boolean))] as string[]

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

  const privateCount   = entries.filter((e) => e.sharing_status === 'private').length
  const shareableCount = entries.filter((e) => e.sharing_status === 'shareable').length
  const totalWords     = entries.reduce((sum, e) => sum + e.content.trim().split(/\s+/).filter(Boolean).length, 0)

  const domains = [...new Set(entries.map((e) => e.domain))] as Domain[]

  return (
    <div className="space-y-12">
      <FadeUp className="space-y-2">
        <p className="text-label">Review</p>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          {entries.length === 0 ? 'Nothing captured yet.' : `${entries.length} entries.`}
        </p>
        {entries.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {totalWords.toLocaleString()} words · {shareableCount} for heirs · {privateCount} only you
          </p>
        )}
      </FadeUp>

      {entries.length === 0 ? (
        <FadeUp delay={0.1}>
          <div className="border border-border rounded-lg px-5 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Start in{' '}
              <a href="/app/interview" className="text-foreground underline underline-offset-4">Capture</a>.
            </p>
          </div>
        </FadeUp>
      ) : (
        <ReviewClient
          entries={entries}
          promptMap={promptMap}
          domains={domains}
        />
      )}
    </div>
  )
}
