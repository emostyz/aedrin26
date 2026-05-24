import { createClient } from '@/lib/supabase/server'
import { Timeline } from '@/components/lifemap/timeline'
import { FadeUp } from '@/components/ui/motion'

export default async function LifeMapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data, error }, { count: entryCount }] = await Promise.all([
    supabase.from('life_events').select('*').eq('user_id', user.id)
      .order('event_date', { ascending: true, nullsFirst: false }),
    supabase.from('soul_entries').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  if (error) return (
    <div className="border border-border rounded-lg px-5 py-10 text-center">
      <p className="text-sm text-destructive">Failed to load. Please try again.</p>
    </div>
  )

  return (
    <div className="space-y-12">
      <FadeUp className="space-y-2">
        <p className="text-label">Life map</p>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          The moments that shaped you.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
          Key events extracted from your Capture sessions, arranged in time. The more you share in interviews, the richer this becomes.
        </p>
      </FadeUp>
      <Timeline
        initialEvents={(data ?? []) as Parameters<typeof Timeline>[0]['initialEvents']}
        hasSoulEntries={(entryCount ?? 0) > 0}
      />
    </div>
  )
}
