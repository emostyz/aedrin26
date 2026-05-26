import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyReplyToken } from '@/lib/reply-token'
import { stripQuotedReply } from '@/lib/reply-parse'

// POST /api/inbound/email
// Resend Inbound webhook (event: "email.received"), Svix-signed.
// The user replied to a daily-reminder email; the Reply-To carried a signed
// token (reply+<token>@<inbound-domain>) identifying user + prompt. We verify
// the webhook, verify the token, fetch the body, and save it as the answer.
//
// Activation requires (operator):
//   - Resend Inbound enabled (managed .resend.app domain or aedrin.com MX)
//   - This URL registered as the inbound webhook → RESEND_WEBHOOK_SECRET
//   - RESEND_INBOUND_DOMAIN set (the receiving domain)
//   - REPLY_TOKEN_SECRET set
//   - RESEND_API_KEY must be FULL-ACCESS (send-only keys can't read bodies)

function verifySvix(rawBody: string, headers: Headers, secretRaw: string): boolean {
  const id = headers.get('svix-id')
  const ts = headers.get('svix-timestamp')
  const sigHeader = headers.get('svix-signature')
  if (!id || !ts || !sigHeader) return false
  const secret = Buffer.from(secretRaw.replace(/^whsec_/, ''), 'base64')
  const signed = `${id}.${ts}.${rawBody}`
  const expected = crypto.createHmac('sha256', secret).update(signed).digest('base64')
  // svix-signature: space-separated "v1,<sig>" entries
  return sigHeader.split(' ').some((part) => {
    const sig = part.split(',')[1]
    if (!sig || sig.length !== expected.length) return false
    try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) } catch { return false }
  })
}

function extractToken(to: unknown): string | null {
  const addrs: string[] = Array.isArray(to)
    ? to.map((t) => (typeof t === 'string' ? t : (t as { email?: string })?.email ?? ''))
    : typeof to === 'string' ? [to] : []
  for (const addr of addrs) {
    const m = addr.match(/reply\+([^@]+)@/i)
    if (m) return m[1]
  }
  return null
}

// Resend webhooks carry metadata only; fetch the body separately (full key).
async function fetchInboundBody(emailId: string): Promise<string | null> {
  const key = process.env.RESEND_API_KEY
  if (!key || !emailId) return null
  try {
    const res = await fetch(`https://api.resend.com/emails/${emailId}`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (!res.ok) {
      console.error('[inbound] body fetch failed', res.status, (await res.text()).slice(0, 200))
      return null
    }
    const data = (await res.json()) as { text?: string; html?: string }
    return data.text ?? (data.html ? data.html.replace(/<[^>]+>/g, ' ') : null)
  } catch (err) {
    console.error('[inbound] body fetch error', err)
    return null
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Inbound not configured.' }, { status: 503 })

  const raw = await request.text()
  if (!verifySvix(raw, request.headers, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: { type?: string; data?: Record<string, unknown> }
  try { event = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Bad payload' }, { status: 400 }) }
  if (event.type !== 'email.received' || !event.data) {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const data = event.data
  const token = extractToken(data.to)
  if (!token) return NextResponse.json({ ok: true, ignored: 'no token' })

  const claims = verifyReplyToken(token)
  if (!claims) return NextResponse.json({ ok: true, ignored: 'bad token' })

  const emailId = (data.email_id as string) || (data.id as string) || ''
  const body = await fetchInboundBody(emailId)
  const content = stripQuotedReply(body ?? '')
  if (!content) return NextResponse.json({ ok: true, ignored: 'empty body' })

  const service = createServiceClient()

  // Idempotent: first reply for this prompt wins (guards against webhook retries).
  const { data: existing } = await service
    .from('soul_entries')
    .select('id')
    .eq('user_id', claims.u)
    .eq('daily_prompt_id', claims.p)
    .maybeSingle() as { data: { id: string } | null }
  if (existing) return NextResponse.json({ ok: true, deduped: true })

  const { error } = await service.from('soul_entries').insert({
    user_id: claims.u,
    domain: claims.d,
    content,
    daily_prompt_id: claims.p,
    source: 'typed',
  })
  if (error) {
    console.error('[inbound] save failed', error.message)
    return NextResponse.json({ error: 'save failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, saved: true })
}
