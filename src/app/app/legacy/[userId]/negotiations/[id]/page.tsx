import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveLegacyAccess } from '@/lib/legacy-access'
import { NegotiationRoom } from '@/components/negotiation/negotiation-room'

export default async function NegotiationRoomPage({
  params,
}: {
  params: Promise<{ userId: string; id: string }>
}) {
  const { userId, id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const access = await resolveLegacyAccess(userId, user)
  if (!access || !access.canNegotiate) notFound()

  const service = createServiceClient()

  const { data: negData } = await service
    .from('negotiations')
    .select('id, deceased_user_id, title, description, status, created_by_user_id')
    .eq('id', id)
    .maybeSingle()
  const negotiation = negData as {
    id: string; deceased_user_id: string; title: string; description: string | null
    status: string; created_by_user_id: string
  } | null
  if (!negotiation || negotiation.deceased_user_id !== userId) notFound()

  const [partsRes, msgsRes, propsRes] = await Promise.all([
    service.from('negotiation_participants')
      .select('id, participant_user_id, display_name, relationship_to_deceased, relationship_context, non_negotiables')
      .eq('negotiation_id', id).eq('consent_status', 'joined'),
    service.from('negotiation_messages')
      .select('id, author_type, author_participant_id, content, cited_entry_ids, created_at')
      .eq('negotiation_id', id).order('created_at', { ascending: true }),
    service.from('negotiation_proposals')
      .select('id, content, status, proposed_by_participant_id, created_at')
      .eq('negotiation_id', id).order('created_at', { ascending: true }),
  ])

  const participants = (partsRes.data ?? []) as Array<{
    id: string; participant_user_id: string | null; display_name: string
    relationship_to_deceased: string; relationship_context: string | null; non_negotiables: string[]
  }>
  const rawMessages = (msgsRes.data ?? []) as Array<{
    id: string; author_type: string; author_participant_id: string | null
    content: string; cited_entry_ids: string[]; created_at: string
  }>
  const proposals = (propsRes.data ?? []) as Array<{
    id: string; content: string; status: string; proposed_by_participant_id: string | null; created_at: string
  }>

  const nameById = new Map(participants.map((p) => [p.id, p.display_name]))

  // Responses for all proposals in one query
  const proposalIds = proposals.map((p) => p.id)
  let responses: Array<{ proposal_id: string; participant_id: string; response: string; comment: string | null }> = []
  if (proposalIds.length > 0) {
    const { data: respData } = await service
      .from('negotiation_proposal_responses')
      .select('proposal_id, participant_id, response, comment')
      .in('proposal_id', proposalIds)
    responses = (respData ?? []) as typeof responses
  }

  const currentParticipant = participants.find((p) => p.participant_user_id === user.id) ?? null

  const messages = rawMessages.map((m) => ({
    id: m.id,
    authorType: m.author_type,
    authorName: m.author_type === 'mediator' ? 'Mediator'
      : m.author_type === 'system' ? 'System'
      : (m.author_participant_id ? nameById.get(m.author_participant_id) ?? 'A participant' : 'A participant'),
    content: m.content,
    citedCount: m.cited_entry_ids?.length ?? 0,
    isMine: !!m.author_participant_id && m.author_participant_id === currentParticipant?.id,
  }))

  const proposalsView = proposals.map((p) => ({
    id: p.id,
    content: p.content,
    status: p.status,
    proposerName: p.proposed_by_participant_id ? nameById.get(p.proposed_by_participant_id) ?? 'A participant' : 'A participant',
    responses: responses
      .filter((r) => r.proposal_id === p.id)
      .map((r) => ({
        participantName: nameById.get(r.participant_id) ?? 'A participant',
        response: r.response,
        comment: r.comment,
        isMine: r.participant_id === currentParticipant?.id,
      })),
  }))

  return (
    <NegotiationRoom
      deceasedUserId={userId}
      deceasedName={access.deceasedName}
      negotiation={{
        id: negotiation.id,
        title: negotiation.title,
        description: negotiation.description,
        status: negotiation.status,
      }}
      isCreator={negotiation.created_by_user_id === user.id}
      isParticipant={!!currentParticipant}
      participants={participants.map((p) => ({
        id: p.id,
        displayName: p.display_name,
        relationship: p.relationship_to_deceased,
        relationshipContext: p.relationship_context,
        nonNegotiables: p.non_negotiables,
      }))}
      messages={messages}
      proposals={proposalsView}
    />
  )
}
