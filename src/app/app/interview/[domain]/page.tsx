import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InterviewDomain } from '@/components/interview/interview-domain'
import { getOrCreateTodaysPrompt } from '@/app/actions/daily-prompt'
import { getOrRefreshDomainNarrative } from '@/app/actions/domain-narrative'
import type { Database, Domain } from '@/lib/supabase/types'

type Prompt = Database['public']['Tables']['interview_prompts']['Row']
type SoulEntry = Database['public']['Tables']['soul_entries']['Row']

const VALID_DOMAINS: Domain[] = ['childhood', 'family', 'career', 'values', 'beliefs', 'lessons', 'messages', 'other']

const DOMAIN_LABELS: Record<Domain, string> = {
  childhood: 'Childhood',
  family: 'Family',
  career: 'Career',
  values: 'Values',
  beliefs: 'Beliefs',
  lessons: 'Lessons',
  messages: 'Messages',
  other: 'Other',
}

type Props = { params: Promise<{ domain: string }> }

export default async function InterviewDomainPage({ params }: Props) {
  const { domain: domainParam } = await params

  if (!VALID_DOMAINS.includes(domainParam as Domain)) {
    notFound()
  }

  const domain = domainParam as Domain
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Profile fields that surface in specific domains
  const PROFILE_CONTEXT_FIELD: Partial<Record<Domain, string>> = {
    values:  'life_purpose',
    lessons: 'biggest_regret',
    other:   'life_description',
  }
  const profileField = PROFILE_CONTEXT_FIELD[domain]

  const [promptsResult, entriesResult, todayResult, profileResult, customQResult, narrativeResult] = await Promise.all([
    supabase
      .from('interview_prompts')
      .select('*')
      .eq('domain', domain)
      .eq('active', true)
      .order('ord', { ascending: true }),
    supabase
      .from('soul_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('domain', domain)
      .is('bound_recipient_id', null)   // exclude final letters (shown in /app/letters)
      .order('created_at', { ascending: false }),
    getOrCreateTodaysPrompt(),
    profileField
      ? supabase.from('users').select(profileField).eq('id', user.id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('custom_questions')
      .select('*')
      .eq('user_id', user.id)
      .eq('domain', domain)
      .order('created_at', { ascending: true }),
    (['childhood', 'family', 'career', 'other'] as Domain[]).includes(domain)
      ? getOrRefreshDomainNarrative(domain)
      : Promise.resolve({ narrative: null, entryCount: 0 }),
  ])

  const systemPrompts = (promptsResult.data ?? []) as Prompt[]
  const existingEntries = (entriesResult.data ?? []) as SoulEntry[]

  // Merge custom questions into the prompts list (after system prompts)
  const customQRows = (customQResult.data ?? []) as { id: string; domain: Domain; text: string; ord: number; created_at: string }[]
  const customPrompts: Prompt[] = customQRows.map((q, i) => ({
    id: q.id,
    domain: q.domain,
    text: q.text,
    version: 1,
    ord: 9000 + i, // Place after all system prompts
    active: true,
    created_at: q.created_at,
    updated_at: q.created_at,
  }))
  const prompts = [...systemPrompts, ...customPrompts]

  // Expose the daily prompt if it's in this domain
  const dailyPrompt =
    todayResult.prompt?.domain === domain
      ? { id: todayResult.prompt.id, prompt_text: todayResult.prompt.prompt_text }
      : null

  // Profile context: show the relevant intake answer as a pinned card
  const profileContextText: string | null = profileField && profileResult.data
    ? ((profileResult.data as unknown as Record<string, unknown>)[profileField] as string | null) ?? null
    : null

  const PROFILE_CONTEXT_LABEL: Partial<Record<Domain, string>> = {
    values:  'Your stated purpose',
    lessons: 'Your biggest regret',
    other:   'Your life description',
  }

  const domainNarrative = narrativeResult?.narrative ?? null

  return (
    <InterviewDomain
      domain={domain}
      label={DOMAIN_LABELS[domain]}
      prompts={prompts}
      existingEntries={existingEntries}
      dailyPrompt={dailyPrompt}
      profileContext={
        profileContextText
          ? { label: PROFILE_CONTEXT_LABEL[domain] ?? 'From your profile', text: profileContextText }
          : null
      }
      domainNarrative={domainNarrative ? { content: domainNarrative.content, createdAt: domainNarrative.createdAt } : null}
    />
  )
}
