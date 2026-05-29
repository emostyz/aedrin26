import { createClient } from '@/lib/supabase/server'
import { FadeUp } from '@/components/ui/motion'
import { ValuesEditor } from '@/components/values/values-editor'
import { getValueSummaryState } from '@/app/actions/values'

export default async function ValuesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const state = await getValueSummaryState()

  return (
    <div className="space-y-12">
      <FadeUp className="space-y-2">
        <p className="text-label">Values</p>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          What you believe, distilled.
        </p>
        <p className="text-sm text-muted-foreground">
          An AI synthesis of your inner architecture — only generated when there&apos;s enough
          cross-domain material to surface something you wouldn&apos;t have seen yourself.
        </p>
      </FadeUp>

      <FadeUp delay={0.1}>
        <ValuesEditor
          initialSummary={state.summary}
          entryCount={state.entryCount}
          domainCount={state.domainCount}
          totalWords={state.totalWords}
          meetsThreshold={state.meetsThreshold}
          neededEntries={state.neededEntries}
          neededDomains={state.neededDomains}
        />
      </FadeUp>
    </div>
  )
}
