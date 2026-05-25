'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveLegacyAccess } from '@/lib/legacy-access'
import type { User } from '@supabase/supabase-js'

type Service = ReturnType<typeof createServiceClient>

function parseNonNegotiables(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((s) => s.slice(0, 300))
}

async function logNegotiation(
  service: Service,
  negotiationId: string,
  deceasedUserId: string,
  actorUserId: string,
  action: string,
  detail?: string,
) {
  await service.from('negotiation_access_log').insert({
    negotiation_id: negotiationId,
    deceased_user_id: deceasedUserId,
    actor_user_id: actorUserId,
    action,
    detail: detail ?? null,
  })
}

// Resolves the caller's joined participant row for a negotiation, after
// confirming they still hold a can_negotiate grant over the deceased.
async function resolveParticipant(
  service: Service,
  negotiationId: string,
  user: User,
): Promise<
  | { error: string }
  | { negotiation: { id: string; deceased_user_id: string; status: string }; participantId: string }
> {
  const { data: neg } = (await service
    .from('negotiations')
    .select('id, deceased_user_id, status')
    .eq('id', negotiationId)
    .maybeSingle()) as { data: { id: string; deceased_user_id: string; status: string } | null }
  if (!neg) return { error: 'Negotiation not found.' }

  const access = await resolveLegacyAccess(neg.deceased_user_id, user)
  if (!access || !access.canNegotiate) return { error: 'You do not have negotiation access.' }

  const { data: participant } = (await service
    .from('negotiation_participants')
    .select('id')
    .eq('negotiation_id', negotiationId)
    .eq('participant_user_id', user.id)
    .eq('consent_status', 'joined')
    .maybeSingle()) as { data: { id: string } | null }
  if (!participant) return { error: 'You have not joined this negotiation.' }

  return { negotiation: neg, participantId: participant.id }
}

// ── Create a negotiation; the creator becomes the initiator participant ──────
export async function createNegotiation(
  formData: FormData,
): Promise<{ error?: string; success?: boolean; negotiationId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const deceasedUserId = (formData.get('deceased_user_id') as string | null)?.trim()
  const title = (formData.get('title') as string | null)?.trim()
  const description = (formData.get('description') as string | null)?.trim() || null
  const relationship = (formData.get('relationship') as string | null)?.trim()
  const nonNegotiables = parseNonNegotiables(formData.get('non_negotiables') as string | null)

  if (!deceasedUserId || !title || !relationship) {
    return { error: 'Title and your relationship are required.' }
  }
  if (title.length > 200) return { error: 'Title is too long (max 200 characters).' }
  if (description && description.length > 2000) return { error: 'Description is too long.' }

  const access = await resolveLegacyAccess(deceasedUserId, user)
  if (!access || !access.canNegotiate) return { error: 'You do not have negotiation access.' }

  const service = createServiceClient()

  const { data: neg, error } = (await service
    .from('negotiations')
    .insert({ deceased_user_id: deceasedUserId, title, description, created_by_user_id: user.id })
    .select('id')
    .single()) as { data: { id: string } | null; error: { message: string } | null }
  if (error || !neg) return { error: error?.message ?? 'Could not create negotiation.' }

  await service.from('negotiation_participants').insert({
    negotiation_id: neg.id,
    participant_user_id: user.id,
    heir_id: access.heirId,
    display_name: access.heirName,
    relationship_to_deceased: relationship,
    non_negotiables: nonNegotiables,
    role: 'initiator',
    consent_status: 'joined',
    joined_at: new Date().toISOString(),
  })

  await logNegotiation(service, neg.id, deceasedUserId, user.id, 'created', title)
  revalidatePath(`/app/legacy/${deceasedUserId}/negotiations`)
  return { success: true, negotiationId: neg.id }
}

// ── Join an existing negotiation (any can_negotiate grantee may join) ────────
export async function joinNegotiation(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const negotiationId = (formData.get('negotiation_id') as string | null)?.trim()
  const relationship = (formData.get('relationship') as string | null)?.trim()
  const relationshipContext = (formData.get('relationship_context') as string | null)?.trim() || null
  const nonNegotiables = parseNonNegotiables(formData.get('non_negotiables') as string | null)
  if (!negotiationId || !relationship) return { error: 'Your relationship is required.' }

  const service = createServiceClient()
  const { data: neg } = (await service
    .from('negotiations')
    .select('id, deceased_user_id')
    .eq('id', negotiationId)
    .maybeSingle()) as { data: { id: string; deceased_user_id: string } | null }
  if (!neg) return { error: 'Negotiation not found.' }

  const access = await resolveLegacyAccess(neg.deceased_user_id, user)
  if (!access || !access.canNegotiate) return { error: 'You do not have negotiation access.' }

  const { error } = await service
    .from('negotiation_participants')
    .upsert(
      {
        negotiation_id: negotiationId,
        participant_user_id: user.id,
        heir_id: access.heirId,
        display_name: access.heirName,
        relationship_to_deceased: relationship,
        relationship_context: relationshipContext,
        non_negotiables: nonNegotiables,
        role: 'participant',
        consent_status: 'joined',
        joined_at: new Date().toISOString(),
      },
      { onConflict: 'negotiation_id,participant_user_id' },
    )
  if (error) return { error: error.message }

  await logNegotiation(service, negotiationId, neg.deceased_user_id, user.id, 'joined')
  revalidatePath(`/app/legacy/${neg.deceased_user_id}/negotiations/${negotiationId}`)
  return { success: true }
}

export async function postNegotiationMessage(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const negotiationId = (formData.get('negotiation_id') as string | null)?.trim()
  const content = (formData.get('content') as string | null)?.trim()
  if (!negotiationId || !content) return { error: 'Message is required.' }
  if (content.length > 4000) return { error: 'Message is too long (max 4000 characters).' }

  const service = createServiceClient()
  const resolved = await resolveParticipant(service, negotiationId, user)
  if ('error' in resolved) return { error: resolved.error }
  if (resolved.negotiation.status !== 'open') return { error: 'This negotiation is no longer open.' }

  const { error } = await service.from('negotiation_messages').insert({
    negotiation_id: negotiationId,
    author_type: 'participant',
    author_participant_id: resolved.participantId,
    content,
  })
  if (error) return { error: error.message }

  await logNegotiation(service, negotiationId, resolved.negotiation.deceased_user_id, user.id, 'posted')
  revalidatePath(`/app/legacy/${resolved.negotiation.deceased_user_id}/negotiations/${negotiationId}`)
  return { success: true }
}

export async function createProposal(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const negotiationId = (formData.get('negotiation_id') as string | null)?.trim()
  const content = (formData.get('content') as string | null)?.trim()
  if (!negotiationId || !content) return { error: 'Proposal text is required.' }
  if (content.length > 2000) return { error: 'Proposal is too long (max 2000 characters).' }

  const service = createServiceClient()
  const resolved = await resolveParticipant(service, negotiationId, user)
  if ('error' in resolved) return { error: resolved.error }
  if (resolved.negotiation.status !== 'open') return { error: 'This negotiation is no longer open.' }

  const { error } = await service.from('negotiation_proposals').insert({
    negotiation_id: negotiationId,
    proposed_by_participant_id: resolved.participantId,
    content,
  })
  if (error) return { error: error.message }

  await logNegotiation(service, negotiationId, resolved.negotiation.deceased_user_id, user.id, 'proposed')
  revalidatePath(`/app/legacy/${resolved.negotiation.deceased_user_id}/negotiations/${negotiationId}`)
  return { success: true }
}

// ── Respond to a proposal; unanimous acceptance resolves the negotiation ─────
export async function respondToProposal(
  formData: FormData,
): Promise<{ error?: string; success?: boolean; resolved?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const negotiationId = (formData.get('negotiation_id') as string | null)?.trim()
  const proposalId = (formData.get('proposal_id') as string | null)?.trim()
  const response = (formData.get('response') as string | null)?.trim()
  const comment = (formData.get('comment') as string | null)?.trim() || null
  if (!negotiationId || !proposalId || !response) return { error: 'Missing fields.' }
  if (!['accept', 'reject', 'abstain'].includes(response)) return { error: 'Invalid response.' }

  const service = createServiceClient()
  const resolved = await resolveParticipant(service, negotiationId, user)
  if ('error' in resolved) return { error: resolved.error }

  const { data: proposal } = (await service
    .from('negotiation_proposals')
    .select('id, negotiation_id, status')
    .eq('id', proposalId)
    .maybeSingle()) as { data: { id: string; negotiation_id: string; status: string } | null }
  if (!proposal || proposal.negotiation_id !== negotiationId) return { error: 'Proposal not found.' }
  if (proposal.status !== 'proposed') return { error: 'This proposal is no longer open for responses.' }

  const { error } = await service
    .from('negotiation_proposal_responses')
    .upsert(
      { proposal_id: proposalId, participant_id: resolved.participantId, response, comment },
      { onConflict: 'proposal_id,participant_id' },
    )
  if (error) return { error: error.message }

  // Unanimous acceptance among joined participants resolves the negotiation.
  const [partsRes, respsRes] = await Promise.all([
    service.from('negotiation_participants').select('id').eq('negotiation_id', negotiationId).eq('consent_status', 'joined'),
    service.from('negotiation_proposal_responses').select('participant_id, response').eq('proposal_id', proposalId),
  ])
  const joined = (partsRes.data ?? []) as { id: string }[]
  const responses = (respsRes.data ?? []) as { participant_id: string; response: string }[]
  const accepts = new Set(responses.filter((r) => r.response === 'accept').map((r) => r.participant_id))
  const everyoneAccepted = joined.length >= 2 && joined.every((p) => accepts.has(p.id))

  let didResolve = false
  if (everyoneAccepted) {
    await Promise.all([
      service.from('negotiation_proposals').update({ status: 'accepted' }).eq('id', proposalId),
      service.from('negotiations').update({ status: 'resolved' }).eq('id', negotiationId),
    ])
    didResolve = true
  }

  await logNegotiation(service, negotiationId, resolved.negotiation.deceased_user_id, user.id, 'responded', response)
  revalidatePath(`/app/legacy/${resolved.negotiation.deceased_user_id}/negotiations/${negotiationId}`)
  return { success: true, resolved: didResolve }
}

// ── Close/archive a negotiation (creator only) ───────────────────────────────
export async function setNegotiationStatus(
  negotiationId: string,
  status: 'closed' | 'archived',
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }
  if (!['closed', 'archived'].includes(status)) return { error: 'Invalid status.' }

  const service = createServiceClient()
  const { data: neg } = (await service
    .from('negotiations')
    .select('id, deceased_user_id, created_by_user_id')
    .eq('id', negotiationId)
    .maybeSingle()) as { data: { id: string; deceased_user_id: string; created_by_user_id: string } | null }
  if (!neg) return { error: 'Negotiation not found.' }
  if (neg.created_by_user_id !== user.id) return { error: 'Only the initiator can change this.' }

  const { error } = await service.from('negotiations').update({ status }).eq('id', negotiationId)
  if (error) return { error: error.message }

  await logNegotiation(service, negotiationId, neg.deceased_user_id, user.id, 'status', status)
  revalidatePath(`/app/legacy/${neg.deceased_user_id}/negotiations/${negotiationId}`)
  return { success: true }
}
