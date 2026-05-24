import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { LegacyChat } from '@/components/legacy/legacy-chat'

type Props = { params: Promise<{ userId: string }> }

export default async function LegacyPage({ params }: Props) {
  const { userId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceClient()

  // Verify the target account is legacy_active
  const { data: deceasedUser } = await service
    .from('users')
    .select('id, legal_name, display_name, account_state')
    .eq('id', userId)
    .eq('account_state', 'legacy_active')
    .single() as { data: { id: string; legal_name: string; display_name: string | null; account_state: string } | null }

  if (!deceasedUser) notFound()

  // Verify the current user is an active heir for this account (matched by email)
  const { data: heir } = await service
    .from('heirs')
    .select('id, name, access_status')
    .eq('user_id', userId)
    .eq('email', user.email!.toLowerCase())
    .eq('access_status', 'active')
    .single() as { data: { id: string; name: string; access_status: string } | null }

  if (!heir) notFound()

  const displayName = deceasedUser.display_name ?? deceasedUser.legal_name

  return (
    <LegacyChat
      deceasedUserId={userId}
      deceasedName={displayName}
      heirId={heir.id}
      heirName={heir.name}
    />
  )
}
