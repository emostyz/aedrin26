import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InterviewDomain } from '@/components/interview/interview-domain'
import { getOrCreateTodaysPrompt } from '@/app/actions/daily-prompt'
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

  const [promptsResult, entriesResult, todayResult] = await Promise.all([
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
      .order('created_at', { ascending: false }),
    getOrCreateTodaysPrompt(),
  ])

  const prompts = (promptsResult.data ?? []) as Prompt[]
  const existingEntries = (entriesResult.data ?? []) as SoulEntry[]

  // Expose the daily prompt if it's in this domain
  const dailyPrompt =
    todayResult.prompt?.domain === domain
      ? { id: todayResult.prompt.id, prompt_text: todayResult.prompt.prompt_text }
      : null

  return (
    <InterviewDomain
      domain={domain}
      label={DOMAIN_LABELS[domain]}
      prompts={prompts}
      existingEntries={existingEntries}
      dailyPrompt={dailyPrompt}
    />
  )
}
