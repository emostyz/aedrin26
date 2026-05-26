import { createClient } from '@/lib/supabase/server'
import { FadeUp } from '@/components/ui/motion'
import { ValuesEditor } from '@/components/values/values-editor'
import { getOrRefreshValueSummary } from '@/app/actions/values'

export default async function ValuesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Regenerates only when there's new intel since the last summary, once a day.
  const { summary: latest, entryCount } = await getOrRefreshValueSummary()

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
