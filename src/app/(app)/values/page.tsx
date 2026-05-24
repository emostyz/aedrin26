import { createClient } from '@/lib/supabase/server'
import { FadeUp } from '@/components/ui/motion'
import { ValuesEditor } from '@/components/values/values-editor'

export default async function ValuesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: summaries }, { data: entries }] = await Promise.all([
    supabase
      .from('value_summaries')
      .select('id, content, approved_by_user, approved_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('soul_entries')
      .select('id')
      .eq('user_id', user.id)
      .in('domain', ['values', 'beliefs', 'lessons']),
  ])

  const latest = summaries && summaries.length > 0
    ? summaries[0] as { id: string; content: string; approved_by_user: boolean; approved_at: string | null; created_at: string }
    : null

  const entryCount = (entries ?? []).length

  return (
    <div className="space-y-12">
      <FadeUp className="space-y-2">
        <p className="text-label">Values</p>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          What you believe, distilled.
        </p>
        <p className="text-sm text-muted-foreground">
          An AI synthesis of your values, beliefs, and life wisdom — reviewed and approved by you.
        </p>
      </FadeUp>

      <FadeUp delay={0.1}>
        <ValuesEditor initialSummary={latest} entryCount={entryCount} />
      </FadeUp>
    </div>
  )
}
