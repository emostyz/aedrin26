import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveLegacyAccess } from '@/lib/legacy-access'
import { LegacyChat } from '@/components/legacy/legacy-chat'

type Props = { params: Promise<{ userId: string }> }

export default async function LegacyPage({ params }: Props) {
  const { userId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Single shared gate: legacy_active + active heir + (portal grants) unexpired.
  const access = await resolveLegacyAccess(userId, user)
  if (!access) notFound()

  return (
    <LegacyChat
      deceasedUserId={userId}
      deceasedName={access.deceasedName}
      heirId={access.heirId}
      heirName={access.heirName}
      allowedDomains={access.allowedDomains}
      expiresAt={access.expiresAt}
      canNegotiate={access.canNegotiate}
    />
  )
}
