import { createClient } from '@/lib/supabase/server'
import { FadeUp } from '@/components/ui/motion'
import { TodayJournal } from '@/components/today/today-journal'
import { getOrCreateTodaysPrompt } from '@/app/actions/daily-prompt'

export default async function TodayPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const todayStart = `${today}T00:00:00.000Z`
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()

  // "On this day" filter — same month+day in up to 7 previous years
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const onThisDayFilter = Array.from({ length: 7 }, (_, i) => {
    const yr = now.getUTCFullYear() - (i + 1)
    return `and(created_at.gte.${yr}-${mm}-${dd}T00:00:00.000Z,created_at.lte.${yr}-${mm}-${dd}T23:59:59.999Z)`
  }).join(',')

  // Fetch today's entries, past 7 days, today's prompt, and on-this-day in parallel
  const [todayRes, recentRes, todayPromptResult, onThisDayRes] = await Promise.all([
    // Everything written today (any domain)
    supabase
      .from('soul_entries')
      .select('id, content, domain, created_at')
      .eq('user_id', user.id)
      .is('bound_recipient_id', null)
      .gte('created_at', todayStart)
      .order('created_at', { ascending: false }),

    // Last 7 days (not today)
    supabase
      .from('soul_entries')
      .select('id, content, domain, created_at')
      .eq('user_id', user.id)
      .is('bound_recipient_id', null)
      .gte('created_at', sevenDaysAgo)
      .lt('created_at', todayStart)
      .order('created_at', { ascending: false })
      .limit(50),

    getOrCreateTodaysPrompt(),

    // On this day — same calendar date in previous years
    supabase
      .from('soul_entries')
      .select('id, content, domain, created_at')
      .eq('user_id', user.id)
      .is('bound_recipient_id', null)
      .or(onThisDayFilter)
      .order('created_at', { ascending: false }),
  ])

  const todayEntries  = (todayRes.data ?? []) as Array<{ id: string; content: string; domain: string; created_at: string }>
  const recentEntries = (recentRes.data ?? []) as Array<{ id: string; content: string; domain: string; created_at: string }>
  const onThisDayEntries = (onThisDayRes.data ?? []) as Array<{ id: string; content: string; domain: string; created_at: string }>

  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="space-y-10">
      <FadeUp className="space-y-2">
        <p className="text-label">{dateLabel}</p>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          What&apos;s on your mind?
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
          Write about today — what happened, what you noticed, how you feel. No prompts required.
          For preserving past memories, use{' '}
          <a href="/app/interview" className="text-foreground underline underline-offset-4 hover:opacity-80">
            Capture
          </a>
          .
        </p>
      </FadeUp>

      <FadeUp delay={0.08}>
        <TodayJournal
          todayEntries={todayEntries}
          recentEntries={recentEntries}
          onThisDayEntries={onThisDayEntries}
          todayPromptText={todayPromptResult.prompt?.prompt_text ?? null}
        />
      </FadeUp>
    </div>
  )
}
