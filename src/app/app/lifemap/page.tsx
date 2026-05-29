import { createClient } from '@/lib/supabase/server'
import { Timeline } from '@/components/lifemap/timeline'
import { FadeUp } from '@/components/ui/motion'
import type { Database } from '@/lib/supabase/types'

type SoulEntry = Pick<
  Database['public']['Tables']['soul_entries']['Row'],
  'id' | 'domain' | 'content' | 'created_at'
>

export default async function LifeMapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data, error }, { data: entriesData }] = await Promise.all([
    supabase.from('life_events').select('*').eq('user_id', user.id)
      .order('event_date', { ascending: true, nullsFirst: false }),
    // Fetch entries for the memory layer — exclude letter-bound entries (private letters)
    supabase.from('soul_entries')
      .select('id, domain, content, created_at')
      .eq('user_id', user.id)
      .is('bound_recipient_id', null)
      .order('created_at', { ascending: false })
      .limit(200),
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
          Milestones, memories, and stories — arranged in time. The more you share, the richer this becomes.
        </p>
      </FadeUp>
      <Timeline
        initialEvents={(data ?? []) as Parameters<typeof Timeline>[0]['initialEvents']}
        soulEntries={(entriesData ?? []) as SoulEntry[]}
        hasSoulEntries={(entriesData ?? []).length > 0}
      />
    </div>
  )
}
