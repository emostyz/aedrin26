import { createClient } from '@/lib/supabase/server'
import { FadeUp } from '@/components/ui/motion'
import { ProfileForm } from '@/components/profile/profile-form'
import { ProfileContextForm } from '@/components/profile/profile-context-form'
import { WritingHeatmap } from '@/components/profile/writing-heatmap'
import type { Domain } from '@/lib/supabase/types'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data }, { data: entriesData }, { data: heirsData }, { data: heatmapData }] = await Promise.all([
    supabase
      .from('users')
      .select('legal_name, display_name, dob, photo_url, email, relationship_status, location, company, job_title, job_happiness, career_goals, family_description, life_description, biggest_regret, life_purpose, created_at')
      .eq('id', user.id)
      .single(),
    supabase
      .from('soul_entries')
      .select('domain, content')
      .eq('user_id', user.id)
      .is('bound_recipient_id', null),
    supabase
      .from('heirs')
      .select('id')
      .eq('user_id', user.id),
    // Heatmap: all entry dates for the past ~13 months
    supabase
      .from('soul_entries')
      .select('created_at')
      .eq('user_id', user.id)
      .is('bound_recipient_id', null)
      .gte('created_at', new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString()),
  ])

  const entries = (entriesData ?? []) as { domain: Domain; content: string }[]

  // Build dateCounts: YYYY-MM-DD → number of entries on that day
  const dateCounts: Record<string, number> = {}
  for (const e of (heatmapData ?? []) as { created_at: string }[]) {
    const day = e.created_at.slice(0, 10)
    dateCounts[day] = (dateCounts[day] ?? 0) + 1
  }

  const totalWords = entries.reduce((sum, e) => sum + e.content.trim().split(/\s+/).filter(Boolean).length, 0)
  const domainsExplored = new Set(entries.map((e) => e.domain)).size
  const heirCount = (heirsData ?? []).length
  const memberSince = (data as { created_at?: string } | null)?.created_at
    ? new Date((data as { created_at: string }).created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  const profile = data as {
    legal_name: string
    display_name: string | null
    dob: string | null
    photo_url: string | null
    email: string
    relationship_status: string | null
    location: string | null
    company: string | null
    job_title: string | null
    job_happiness: string | null
    career_goals: string | null
    family_description: string | null
    life_description: string | null
    biggest_regret: string | null
    life_purpose: string | null
  } | null

  return (
    <div className="space-y-16">
      <FadeUp className="space-y-2">
        <p className="text-label">Profile</p>
        <p className="text-[1.75rem] font-light tracking-[-0.03em] text-foreground leading-tight">
          {profile?.display_name ?? profile?.legal_name ?? 'Your profile'}
        </p>
        <p className="text-sm text-muted-foreground">{profile?.email ?? user.email}</p>
        {memberSince && (
          <p className="text-xs text-muted-foreground/60">Member since {memberSince}</p>
        )}
      </FadeUp>

      {/* Story stats */}
      {entries.length > 0 && (
        <FadeUp delay={0.05}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { value: entries.length.toLocaleString(), label: `entr${entries.length === 1 ? 'y' : 'ies'}` },
              { value: totalWords.toLocaleString(), label: 'words written' },
              { value: `${domainsExplored} of 7`, label: 'domains explored' },
              { value: heirCount.toLocaleString(), label: `heir${heirCount === 1 ? '' : 's'} designated` },
            ].map(({ value, label }) => (
              <div key={label} className="border border-border/60 rounded-xl px-4 py-4 text-center space-y-1">
                <p className="text-xl font-light tracking-[-0.02em] text-foreground">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </FadeUp>
      )}

      {/* Writing heatmap */}
      {Object.keys(dateCounts).length > 0 && (
        <FadeUp delay={0.08}>
          <div className="border border-border/60 rounded-xl px-5 py-5">
            <WritingHeatmap dateCounts={dateCounts} />
          </div>
        </FadeUp>
      )}

      <FadeUp delay={0.1}>
        <ProfileForm
          legalName={profile?.legal_name ?? ''}
          displayName={profile?.display_name ?? ''}
          dob={profile?.dob ?? ''}
          photoUrl={profile?.photo_url ?? null}
        />
      </FadeUp>

      <FadeUp delay={0.15}>
        <div className="border-t border-border pt-8">
          <ProfileContextForm
            initialData={{
              relationship_status: profile?.relationship_status ?? null,
              location:            profile?.location ?? null,
              company:             profile?.company ?? null,
              job_title:           profile?.job_title ?? null,
              job_happiness:       profile?.job_happiness ?? null,
              career_goals:        profile?.career_goals ?? null,
              family_description:  profile?.family_description ?? null,
              life_description:    profile?.life_description ?? null,
              biggest_regret:      profile?.biggest_regret ?? null,
              life_purpose:        profile?.life_purpose ?? null,
            }}
          />
        </div>
      </FadeUp>
    </div>
  )
}
