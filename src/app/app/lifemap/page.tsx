import { createClient } from '@/lib/supabase/server'
import { Timeline } from '@/components/lifemap/timeline'
import { FadeUp } from '@/components/ui/motion'

export default async function LifeMapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('life_events').select('*').eq('user_id', user.id)
    .order('event_date', { ascending: true, nullsFirst: false })

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
      </FadeUp>
      <Timeline initialEvents={(data ?? []) as Parameters<typeof Timeline>[0]['initialEvents']} />
    </div>
  )
}
