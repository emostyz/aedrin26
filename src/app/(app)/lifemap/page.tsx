import { createClient } from '@/lib/supabase/server'
import { Timeline } from '@/components/lifemap/timeline'

export default async function LifeMapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: events, error } = await supabase
    .from('life_events')
    .select('*')
    .eq('user_id', user.id)
    .order('event_date', { ascending: true, nullsFirst: false })

  if (error) {
    return (
      <div className="rounded-lg border border-border px-5 py-8 text-center">
        <p className="text-sm text-destructive">Failed to load your life map. Please try again.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Life map</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A chronological scaffold of the moments that shaped you.
        </p>
      </div>
      <Timeline initialEvents={events ?? []} />
    </div>
  )
}
