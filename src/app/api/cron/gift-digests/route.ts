import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmails } from '@/lib/email'
import { giftDigestEmail } from '@/lib/email-templates'
import type { GiftDigestExcerpt } from '@/lib/email-templates'

// GET /api/cron/gift-digests
//
// Runs monthly. For every claimed gift_invitation, looks at what the
// recipient has written in the past ~30 days and sends the sender a quiet
// digest. Only entries the recipient marked as `sharing_status='shareable'`
// are quoted in the body — private entries are reflected only in the count
// ("4 entries added, none shared"). When nothing was written at all, no
// email goes out.
//
// Design choices worth knowing:
//  * No per-row "last_digest_sent_at" column. The cron runs on a fixed
//    schedule and pulls a fixed window; if Vercel ever fires it twice in
//    the same window the duplicate is harmless and rare. We trade a tiny
//    risk of duplicate send for migration simplicity.
//  * The digest is the gift-giver's only signal that the recipient is still
//    showing up. Even when nothing was shared, the "still writing" body
//    matters — silence in this product means abandonment, and we don't want
//    to imply abandonment when there isn't any.

const MAX_BATCH = 200
const WINDOW_DAYS = 30
const PREVIEW_LIMIT = 280            // ~3 sentences
const MAX_EXCERPTS = 4               // keep the digest skimmable

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Cron not configured.' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()

  // 1. All claimed gift links — sender (gift-giver) + recipient (claimed user).
  const { data: giftRows } = await service
    .from('gift_invitations')
    .select('id, sender_user_id, recipient_name, claimed_by_user_id')
    .eq('status', 'claimed')
    .not('claimed_by_user_id', 'is', null)
    .limit(MAX_BATCH) as { data: Array<{
      id: string
      sender_user_id: string
      recipient_name: string
      claimed_by_user_id: string
    }> | null }

  const gifts = giftRows ?? []
  if (gifts.length === 0) return NextResponse.json({ sent: 0 })

  // 2. Resolve sender emails (we need to email them) and recipient activity.
  const senderIds = [...new Set(gifts.map((g) => g.sender_user_id))]
  const recipientIds = [...new Set(gifts.map((g) => g.claimed_by_user_id))]

  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - WINDOW_DAYS)
  const windowStartIso = windowStart.toISOString()

  const [sendersRes, entriesRes] = await Promise.all([
    service
      .from('users')
      .select('id, email, display_name, legal_name')
      .in('id', senderIds),
    // All entries by gifted recipients within the window. We fetch shareable
    // and private alike because the digest body still references the total
    // count, but only quotes the shareable ones.
    service
      .from('soul_entries')
      .select('user_id, content, domain, sharing_status, bound_recipient_id, created_at')
      .in('user_id', recipientIds)
      .is('bound_recipient_id', null)   // never include final letters
      .gte('created_at', windowStartIso)
      .order('created_at', { ascending: false }),
  ])

  type SenderRow = { id: string; email: string; display_name: string | null; legal_name: string }
  type EntryRow  = {
    user_id: string
    content: string
    domain: string
    sharing_status: string
    bound_recipient_id: string | null
    created_at: string
  }

  const sendersById = new Map<string, SenderRow>(
    ((sendersRes.data ?? []) as SenderRow[]).map((s) => [s.id, s]),
  )
  const entries = (entriesRes.data ?? []) as EntryRow[]

  // 3. Group entries by recipient → split into total count + shareable list.
  const entriesByRecipient = new Map<string, EntryRow[]>()
  for (const e of entries) {
    const arr = entriesByRecipient.get(e.user_id) ?? []
    arr.push(e)
    entriesByRecipient.set(e.user_id, arr)
  }

  // 4. Build one digest email per gift relationship where the recipient
  //    has at least one new entry in the window.
  const messages: { to: string; subject: string; html: string }[] = []
  let sentCount = 0

  for (const gift of gifts) {
    const sender = sendersById.get(gift.sender_user_id)
    if (!sender?.email) continue   // can't send if sender has no email on file

    const recipientEntries = entriesByRecipient.get(gift.claimed_by_user_id) ?? []
    if (recipientEntries.length === 0) continue   // total silence — skip

    const shareableExcerpts: GiftDigestExcerpt[] = recipientEntries
      .filter((e) => e.sharing_status === 'shareable')
      .slice(0, MAX_EXCERPTS)
      .map((e) => ({
        preview: previewOf(e.content),
        domain: e.domain,
        createdAt: e.created_at,
      }))

    const senderFirst =
      sender.display_name?.split(/\s+/)[0] ??
      sender.legal_name.split(/\s+/)[0] ??
      'there'

    const tmpl = giftDigestEmail(
      senderFirst,
      gift.recipient_name,
      recipientEntries.length,
      shareableExcerpts,
    )
    messages.push({ to: sender.email, subject: tmpl.subject, html: tmpl.html })
    sentCount++
  }

  if (messages.length > 0) await sendEmails(messages)

  return NextResponse.json({
    sent: sentCount,
    consideredGifts: gifts.length,
    skippedSilent: gifts.length - sentCount,
  })
}

// Trim an entry to a short preview. Tries to cut on a sentence boundary
// for readability; falls back to a hard char cap with an ellipsis.
function previewOf(content: string): string {
  const cleaned = content.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= PREVIEW_LIMIT) return cleaned

  const head = cleaned.slice(0, PREVIEW_LIMIT)
  const lastSentenceEnd = Math.max(
    head.lastIndexOf('. '),
    head.lastIndexOf('! '),
    head.lastIndexOf('? '),
  )
  if (lastSentenceEnd > PREVIEW_LIMIT * 0.6) {
    return head.slice(0, lastSentenceEnd + 1)
  }
  return head.trimEnd() + '…'
}
