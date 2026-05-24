'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// ─── Executor: initiate a memorialization request ─────────────────────────────
export async function initiateMemorialization(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const targetEmail = (formData.get('target_email') as string)?.trim().toLowerCase()
  if (!targetEmail) return { error: 'Target account email is required.' }

  const executorEmail = user.email!.toLowerCase()

  // Find the target user
  const service = createServiceClient()
  const { data: targetUser } = await service
    .from('users')
    .select('id, account_state, legal_name')
    .eq('email', targetEmail)
    .single() as { data: { id: string; account_state: string; legal_name: string } | null }

  if (!targetUser) return { error: 'No account found with that email.' }
  if (targetUser.account_state === 'legacy_active') return { error: 'This account is already in legacy mode.' }

  // Verify the requester is a designated executor for this account
  const { data: executor } = await service
    .from('executors')
    .select('id')
    .eq('user_id', targetUser.id)
    .eq('email', executorEmail)
    .single()

  if (!executor) return { error: 'You are not a designated executor for this account.' }

  // Check for an existing active request
  const { data: existing } = await service
    .from('memorialization_requests')
    .select('id, status')
    .eq('user_id', targetUser.id)
    .not('status', 'in', '(approved,rejected,cancelled)')
    .maybeSingle() as { data: { id: string; status: string } | null }

  if (existing) return { error: `A request is already active (status: ${existing.status}).` }

  const { data: request, error: insertError } = await service
    .from('memorialization_requests')
    .insert({
      user_id: targetUser.id,
      initiated_by_executor_email: executorEmail,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError) return { error: insertError.message }

  // Update account state to memorializing
  await service.from('users').update({ account_state: 'memorializing' }).eq('id', targetUser.id)

  revalidatePath('/app/executor')
  return { success: true, requestId: request.id, deceasedName: targetUser.legal_name }
}

// ─── Executor: submit documents ───────────────────────────────────────────────
export async function submitVerificationDocuments(requestId: string, files: { name: string; url: string; type: string }[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const service = createServiceClient()

  // Verify executor owns this request
  const { data: request } = await service
    .from('memorialization_requests')
    .select('id, status, user_id')
    .eq('id', requestId)
    .eq('initiated_by_executor_email', user.email!.toLowerCase())
    .single() as { data: { id: string; status: string; user_id: string } | null }

  if (!request) return { error: 'Request not found or not yours.' }
  if (request.status !== 'pending') return { error: 'Documents can only be submitted for pending requests.' }

  const docs = files.map((f) => ({
    request_id: requestId,
    document_url: f.url,
    type: f.name,
  }))

  const { error: docError } = await service.from('verification_documents').insert(docs)
  if (docError) return { error: docError.message }

  const gracePeriodEndsAt = new Date()
  gracePeriodEndsAt.setDate(gracePeriodEndsAt.getDate() + 30)

  const { error: updateError } = await service
    .from('memorialization_requests')
    .update({ status: 'docs_submitted', grace_period_ends_at: gracePeriodEndsAt.toISOString() })
    .eq('id', requestId)

  if (updateError) return { error: updateError.message }

  revalidatePath('/app/executor')
  return { success: true }
}

// ─── Author: cancel a request during grace period ────────────────────────────
export async function cancelMemorialization(requestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('memorialization_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
    .eq('user_id', user.id)
    .in('status', ['pending', 'docs_submitted', 'grace_period'])

  if (error) return { error: error.message }

  // Restore account state
  const service = createServiceClient()
  await service.from('users').update({ account_state: 'active' }).eq('id', user.id)

  revalidatePath('/app/settings/memorialization')
  return { success: true }
}
