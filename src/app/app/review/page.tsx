import { createClient } from '@/lib/supabase/server'
import { EntryCard } from '@/components/review/entry-card'
import { FadeUp, Stagger, StaggerItem } from '@/components/ui/motion'
import type { Database, Domain } from '@/lib/supabase/types'

type SoulEntry = Database['public']['Tables']['soul_entries']['Row']

const DOMAIN_LABELS: Record<Domain, string> = {
  childhood: 'Childhood', family: 'Family', career: 'Career',
  values: 'Values', beliefs: 'Beliefs', lessons: 'Lessons',
  messages: 'Messages', other: 'Other',
}

export default async function ReviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('soul_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return (
    <div className="border border-border rounded-lg px-5 py-10 text-center">
      <p className="text-sm text-destructive">Failed to load. Please try again.</p>
    </div>
  )

  const entries = (data ?? []) as SoulEntry[]

  // Collect unique prompt IDs so we can fetch their text in two parallel lookups
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

  const byDomain = entries.reduce<Record<string, SoulEntry[]>>((acc, e) => {
    if (!acc[e.domain]) acc[e.domain] = []
    acc[e.domain]!.push(e)
    return acc
  }, {})
  const domains = Object.keys(byDomain) as Domain[]

  const privateCount   = entries.filter((e) => e.sharing_status === 'private').length
  const shareableCount = entries.filter((e) => e.sharing_status === 'shareable').length

  return (
    <div className="space-y-12">
      <FadeUp className="space-y-2">
        <p className="text-label">Review</p>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          {entries.length === 0 ? 'Nothing captured yet.' : `${entries.length} entries.`}
        </p>
        {entries.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {shareableCount} for heirs · {privateCount} only you
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
        <Stagger className="space-y-10">
          {domains.map((domain) => (
            <StaggerItem key={domain}>
              <section className="space-y-3">
                <p className="text-label">{DOMAIN_LABELS[domain] ?? domain}</p>
                <div className="space-y-2">
                  {byDomain[domain]!.map((entry) => {
                    const promptText =
                      (entry.prompt_id       ? interviewMap[entry.prompt_id]       : null) ??
                      (entry.daily_prompt_id ? dailyMap[entry.daily_prompt_id]     : null) ??
                      null
                    return (
                      <EntryCard key={entry.id} entry={entry} promptText={promptText} />
                    )
                  })}
                </div>
              </section>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  )
}
