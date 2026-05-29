import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FadeUp } from '@/components/ui/motion'
import { PeopleExtract } from '@/components/memoir/people-extract'

export default async function MemoirPeoplePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { count } = await supabase
    .from('soul_entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('bound_recipient_id', null)

  const entryCount = count ?? 0

  return (
    <div className="space-y-8">
      <FadeUp className="space-y-2">
        <div className="flex items-center gap-2">
          <Link href="/app/memoir" className="text-label hover:text-muted-foreground transition-colors">
            Memoir
          </Link>
          <span className="text-muted-foreground/40">›</span>
          <p className="text-label">People</p>
        </div>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          The cast of your story.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
          Every great memoir has a cast of characters — the people who shaped it. The AI reads your entries and extracts everyone you&apos;ve written about.
        </p>
      </FadeUp>

      <FadeUp delay={0.08}>
        <PeopleExtract entryCount={entryCount} />
      </FadeUp>
    </div>
  )
}
