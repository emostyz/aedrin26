import { createClient } from '@/lib/supabase/server'
import { LifeReviewClient } from '@/components/interview/life-review-client'
import type { Domain } from '@/lib/supabase/types'

// Domains used across all Life Review chapters
const LIFE_REVIEW_DOMAINS: Domain[] = ['childhood', 'career', 'family', 'lessons', 'values']

export default async function LifeReviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [profileResult, entriesResult] = await Promise.all([
    supabase.from('users').select('display_name, dob').eq('id', user.id).single(),
    supabase
      .from('soul_entries')
      .select('domain')
      .eq('user_id', user.id)
      .in('domain', LIFE_REVIEW_DOMAINS)
      .is('bound_recipient_id', null),
  ])

  const displayName = (profileResult.data as { display_name: string | null } | null)?.display_name ?? null

  const entries = (entriesResult.data ?? []) as { domain: string }[]
  const entriesByDomain = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.domain] = (acc[e.domain] ?? 0) + 1
    return acc
  }, {})

  return (
    <LifeReviewClient
      displayName={displayName}
      entriesByDomain={entriesByDomain}
    />
  )
}
