'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail } from '@/lib/email'
import { giftInvitationEmail, giftClaimedEmail } from '@/lib/email-templates'
import { revalidatePath } from 'next/cache'
import type { GiftRelationship, GiftStatus } from '@/lib/supabase/types'

const BASE_URL = process.env.BASE_URL || 'https://www.aedrin.com'

const VALID_RELATIONSHIPS: GiftRelationship[] = [
  'parent', 'grandparent', 'partner', 'sibling', 'child', 'friend', 'other',
]

// Limits — keep the form honest, prevent abusive use.
const MAX_NOTE_LENGTH = 500
const MAX_NAME_LENGTH = 80
const MAX_INVITES_PER_DAY = 5  // per sender

export interface GiftInvitation {
  id: string
  recipient_name: string
  recipient_email: string
  relationship: GiftRelationship
  sender_note: string | null
  status: GiftStatus
  created_at: string
  claimed_at: string | null
}

export interface PublicGiftInvitation {
  /** Recipient first-name only — used to greet them on the claim page. */
  recipientFirstName: string
  senderName: string
  senderFirstName: string
  relationship: GiftRelationship
  senderNote: string | null
  expiresAt: string
  alreadyClaimed: boolean
  expired: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Sender: create a new invitation
// ─────────────────────────────────────────────────────────────────────────────

export async function createGiftInvitation(formData: FormData): Promise<{
  error?: string
  invitationId?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be signed in to send a gift.' }

  const recipientName  = (formData.get('recipient_name')  as string | null)?.trim()  ?? ''
  const recipientEmail = (formData.get('recipient_email') as string | null)?.trim().toLowerCase() ?? ''
  const relationship   = (formData.get('relationship')    as string | null)?.trim()  ?? ''
  const senderNote     = (formData.get('sender_note')     as string | null)?.trim()  || null

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!recipientName) return { error: 'Please add the recipient\'s name.' }
  if (recipientName.length > MAX_NAME_LENGTH) {
    return { error: 'Name is too long.' }
  }
  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return { error: 'Please add a valid email address.' }
  }
  if (!VALID_RELATIONSHIPS.includes(relationship as GiftRelationship)) {
    return { error: 'Please pick a relationship.' }
  }
  if (senderNote && senderNote.length > MAX_NOTE_LENGTH) {
    return { error: `Note is too long (max ${MAX_NOTE_LENGTH} characters).` }
  }

  // ── Don't let people invite themselves ────────────────────────────────────
  if (recipientEmail === user.email?.toLowerCase()) {
    return { error: 'You can\'t send a gift to yourself.' }
  }

  // ── Rate limit: stop runaway sends from one account ───────────────────────
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('gift_invitations')
    .select('id', { count: 'exact', head: true })
    .eq('sender_user_id', user.id)
    .gte('created_at', since)
  if ((count ?? 0) >= MAX_INVITES_PER_DAY) {
    return { error: `You've sent ${MAX_INVITES_PER_DAY} invitations today. Try again tomorrow.` }
  }

  // ── Prevent duplicate pending invites for the same recipient ──────────────
  const { data: existingPending } = await supabase
    .from('gift_invitations')
    .select('id')
    .eq('sender_user_id', user.id)
    .eq('recipient_email', recipientEmail)
    .eq('status', 'sent')
    .maybeSingle()
  if (existingPending) {
    return { error: 'You\'ve already sent a pending invitation to that email. Wait for them to respond, or it\'ll expire in 90 days.' }
  }

  // ── Fetch sender's display name for the email body ────────────────────────
  const { data: senderProfile } = await supabase
    .from('users')
    .select('display_name, legal_name')
    .eq('id', user.id)
    .single() as { data: { display_name: string | null; legal_name: string } | null }
  const senderName = senderProfile?.display_name ?? senderProfile?.legal_name ?? 'A friend'

  // ── Insert the invitation row ─────────────────────────────────────────────
  const { data: invitation, error: insertError } = await supabase
    .from('gift_invitations')
    .insert({
      sender_user_id:  user.id,
      recipient_name:  recipientName,
      recipient_email: recipientEmail,
      relationship:    relationship as GiftRelationship,
      sender_note:     senderNote,
    })
    .select('id, claim_token')
    .single() as { data: { id: string; claim_token: string } | null; error: { message: string } | null }

  if (insertError || !invitation) {
    return { error: insertError?.message ?? 'Could not create invitation.' }
  }

  // ── Send the email ────────────────────────────────────────────────────────
  // Failure here doesn't destroy the row — the sender can re-send later from
  // their dashboard if delivery fell through.
  const claimUrl = `${BASE_URL}/gift/${invitation.claim_token}`
  const tmpl = giftInvitationEmail(senderName, recipientName, relationship, senderNote, claimUrl)

  const result = await sendEmail({
    to: recipientEmail,
    subject: tmpl.subject,
    html: tmpl.html,
    // Set replyTo to the sender's email so the recipient can reply with
    // a question/objection — it lands in the sender's inbox, not ours.
    replyTo: user.email ?? undefined,
  })

  if (!result.ok) {
    console.error('[gift] email send failed for invitation', invitation.id, result.error)
    // We still return success — the row was created. The sender can resend.
  }

  revalidatePath('/app/gift')
  return { invitationId: invitation.id }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sender: list their outgoing invitations
// ─────────────────────────────────────────────────────────────────────────────

export async function listMyGiftInvitations(): Promise<GiftInvitation[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('gift_invitations')
    .select('id, recipient_name, recipient_email, relationship, sender_note, status, created_at, claimed_at')
    .eq('sender_user_id', user.id)
    .order('created_at', { ascending: false })

  return (data ?? []) as GiftInvitation[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Recipient: fetch invitation by token (PUBLIC — no auth)
// ─────────────────────────────────────────────────────────────────────────────
// Uses the service client to bypass RLS because the token in the URL is
// the proof of authorization. The recipient hasn't signed in yet at this point.

export async function getGiftInvitationByToken(
  token: string,
): Promise<PublicGiftInvitation | null> {
  if (!token) return null

  const service = createServiceClient()
  const { data: inv } = await service
    .from('gift_invitations')
    .select('id, recipient_name, sender_user_id, relationship, sender_note, status, expires_at, claimed_by_user_id')
    .eq('claim_token', token)
    .maybeSingle() as { data: {
      id: string
      recipient_name: string
      sender_user_id: string
      relationship: GiftRelationship
      sender_note: string | null
      status: GiftStatus
      expires_at: string
      claimed_by_user_id: string | null
    } | null }

  if (!inv) return null

  // Resolve the sender's name from the users table.
  const { data: sender } = await service
    .from('users')
    .select('display_name, legal_name')
    .eq('id', inv.sender_user_id)
    .single() as { data: { display_name: string | null; legal_name: string } | null }
  const senderName      = sender?.display_name ?? sender?.legal_name ?? 'A friend'
  const senderFirstName = senderName.split(/\s+/)[0]

  const expired = new Date(inv.expires_at) < new Date() || inv.status === 'expired'

  return {
    recipientFirstName: inv.recipient_name.split(/\s+/)[0],
    senderName,
    senderFirstName,
    relationship: inv.relationship,
    senderNote: inv.sender_note,
    expiresAt: inv.expires_at,
    alreadyClaimed: inv.status === 'claimed',
    expired,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Recipient: claim an invitation after signing up
// ─────────────────────────────────────────────────────────────────────────────
// Called after the recipient successfully signs up / logs in. We require an
// authenticated session AND a matching email between the auth user and the
// invitation row — preventing someone from claiming a gift sent to a
// different address.

export async function claimGiftInvitation(token: string): Promise<{
  error?: string
  claimed?: boolean
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return { error: 'You need to be signed in to claim a gift.' }

  const service = createServiceClient()
  const { data: inv } = await service
    .from('gift_invitations')
    .select('id, sender_user_id, recipient_email, recipient_name, status, expires_at')
    .eq('claim_token', token)
    .maybeSingle() as { data: {
      id: string
      sender_user_id: string
      recipient_email: string
      recipient_name: string
      status: GiftStatus
      expires_at: string
    } | null }

  if (!inv) return { error: 'Invitation not found.' }

  // Already claimed → idempotent success if claimed by THIS user.
  if (inv.status === 'claimed') {
    return { claimed: true }
  }
  if (inv.status !== 'sent') {
    return { error: 'This invitation is no longer active.' }
  }
  if (new Date(inv.expires_at) < new Date()) {
    return { error: 'This invitation has expired.' }
  }

  // Email match — case-insensitive.
  if (inv.recipient_email.toLowerCase() !== user.email.toLowerCase()) {
    return { error: 'This invitation was sent to a different email address. Sign in with that email to claim it.' }
  }

  // Atomically flip status to claimed.
  const { error: updateError } = await service
    .from('gift_invitations')
    .update({
      status: 'claimed',
      claimed_by_user_id: user.id,
      claimed_at: new Date().toISOString(),
    })
    .eq('id', inv.id)
    .eq('status', 'sent')  // optimistic concurrency — only flip if still pending

  if (updateError) return { error: updateError.message }

  // Notify the sender — fire-and-forget; recipient experience shouldn't
  // depend on whether the sender's notification reaches them right now.
  void notifySenderOfClaim(service, inv.sender_user_id, inv.recipient_name)

  return { claimed: true }
}

async function notifySenderOfClaim(
  service: ReturnType<typeof createServiceClient>,
  senderUserId: string,
  recipientName: string,
): Promise<void> {
  try {
    const { data: sender } = await service
      .from('users')
      .select('email, display_name, legal_name')
      .eq('id', senderUserId)
      .single() as { data: { email: string; display_name: string | null; legal_name: string } | null }
    if (!sender?.email) return

    const senderFirst =
      sender.display_name?.split(/\s+/)[0] ??
      sender.legal_name.split(/\s+/)[0] ??
      'there'

    const tmpl = giftClaimedEmail(senderFirst, recipientName)
    await sendEmail({ to: sender.email, subject: tmpl.subject, html: tmpl.html })
  } catch (err) {
    console.error('[gift] sender notification failed:', err)
  }
}
