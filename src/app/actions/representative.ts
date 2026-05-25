'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { screenAccessRequest } from '@/lib/risk-screen'
import type { ClaimedRole } from '@/lib/supabase/types'

const VALID_ROLES: ClaimedRole[] = ['heir', 'executor', 'legal_representative', 'next_of_kin', 'other']
const GRANT_DAYS = 90

// ── Create a request to access a deceased person's recorded context ──────────
export async function createAccessRequest(
  formData: FormData,
): Promise<{ error?: string; success?: boolean; requestId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const deceasedEmail = (formData.get('deceased_email') as string | null)?.trim().toLowerCase()
  const claimedRole = (formData.get('claimed_role') as string | null)?.trim() as ClaimedRole | undefined
  const relationship = (formData.get('relationship') as string | null)?.trim()
  const message = (formData.get('message') as string | null)?.trim() || null

  if (!deceasedEmail || !claimedRole || !relationship) {
    return { error: 'Email, role, and relationship are required.' }
  }
  if (!VALID_ROLES.includes(claimedRole)) return { error: 'Invalid role.' }
  if (relationship.length > 200) return { error: 'Relationship is too long.' }
  if (message && message.length > 2000) return { error: 'Message is too long (max 2000 characters).' }

  const service = createServiceClient()

  const { data: deceased } = (await service
    .from('users')
    .select('id, account_state')
    .eq('email', deceasedEmail)
    .maybeSingle()) as { data: { id: string; account_state: string } | null }

  if (!deceased) return { error: 'No AEDRIN account is associated with that email address.' }
  if (deceased.id === user.id) return { error: 'You cannot request access to your own account.' }
  if (deceased.account_state === 'active') {
    return { error: 'This account is active. Representative access is only available after memorialization.' }
  }

  // Don't create duplicate live requests for the same subject.
  const { data: existing } = (await service
    .from('access_requests')
    .select('id, status')
    .eq('requester_user_id', user.id)
    .eq('deceased_user_id', deceased.id)
    .not('status', 'in', '("approved","rejected","cancelled","expired")')
    .maybeSingle()) as { data: { id: string; status: string } | null }

  if (existing) return { success: true, requestId: existing.id }

  const { data: inserted, error } = (await supabase
    .from('access_requests')
    .insert({
      deceased_user_id: deceased.id,
      requester_user_id: user.id,
      requester_email: user.email!.toLowerCase(),
      claimed_role: claimedRole,
      relationship,
      message,
    })
    .select('id')
    .single()) as { data: { id: string } | null; error: { message: string } | null }

  if (error || !inserted) return { error: error?.message ?? 'Could not create request.' }

  revalidatePath('/app/represent')
  return { success: true, requestId: inserted.id }
}

export async function cancelAccessRequest(
  requestId: string,
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('access_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
    .eq('requester_user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/app/represent')
  revalidatePath(`/app/represent/${requestId}`)
  return { success: true }
}

// ── Accept attestation, run the NLP risk screen, auto-approve or escalate ────
export async function submitForVerification(
  requestId: string,
): Promise<{ error?: string; success?: boolean; status?: string; autoApproved?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const service = createServiceClient()

  const { data: req } = (await service
    .from('access_requests')
    .select('id, deceased_user_id, requester_user_id, requester_email, claimed_role, relationship, message, status')
    .eq('id', requestId)
    .maybeSingle()) as {
    data: {
      id: string
      deceased_user_id: string
      requester_user_id: string
      requester_email: string
      claimed_role: string
      relationship: string
      message: string | null
      status: string
    } | null
  }

  if (!req || req.requester_user_id !== user.id) return { error: 'Request not found.' }
  if (!['submitted', 'docs_submitted'].includes(req.status)) {
    return { error: 'This request has already been submitted for review.' }
  }

  const [deceasedRes, docsRes, heirRes] = await Promise.all([
    service.from('users').select('account_state').eq('id', req.deceased_user_id).maybeSingle(),
    service.from('access_request_documents').select('id').eq('request_id', requestId),
    service.from('heirs').select('id').eq('user_id', req.deceased_user_id).eq('email', req.requester_email).maybeSingle(),
  ])
  const deceased = deceasedRes.data as { account_state: string } | null
  const docs = docsRes.data as { id: string }[] | null
  const heir = heirRes.data as { id: string } | null

  const isPreDesignated = !!heir
  const screen = await screenAccessRequest({
    claimedRole: req.claimed_role,
    relationship: req.relationship,
    message: req.message,
    isPreDesignated,
    documentCount: docs?.length ?? 0,
    deceasedAccountState: deceased?.account_state ?? 'unknown',
  })

  const now = new Date().toISOString()
  const canAutoApprove =
    screen.riskLevel === 'low' &&
    isPreDesignated &&
    deceased?.account_state === 'legacy_active' &&
    !!heir

  if (canAutoApprove && heir) {
    const expiresAt = new Date(Date.now() + GRANT_DAYS * 24 * 60 * 60 * 1000).toISOString()
    await service
      .from('heirs')
      .update({
        access_status: 'active',
        verified_at: now,
        verification_request_id: requestId,
        access_expires_at: expiresAt,
        can_negotiate: true,
      })
      .eq('id', heir.id)

    await service
      .from('access_requests')
      .update({
        status: 'approved',
        attestation_accepted_at: now,
        risk_level: screen.riskLevel,
        risk_reasons: screen.reasons,
        auto_approved: true,
        decided_by: 'auto',
        decided_at: now,
      })
      .eq('id', requestId)

    revalidatePath('/app/represent')
    revalidatePath(`/app/represent/${requestId}`)
    return { success: true, status: 'approved', autoApproved: true }
  }

  await service
    .from('access_requests')
    .update({
      status: 'pending_review',
      attestation_accepted_at: now,
      risk_level: screen.riskLevel,
      risk_reasons: screen.reasons,
    })
    .eq('id', requestId)

  revalidatePath('/app/represent')
  revalidatePath(`/app/represent/${requestId}`)
  return { success: true, status: 'pending_review' }
}
