// Transactional email via Resend's REST API (no SDK dependency).
//
// Activation is gated on two env vars the operator must provide:
//   RESEND_API_KEY  — from https://resend.com
//   EMAIL_FROM      — a verified sender, e.g. "AEDRIN <hello@aedrin.com>"
// Until both are set, sends are skipped (logged, never thrown) so the app
// behaves identically with or without email configured.

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export interface SendEmailResult {
  ok: boolean
  skipped?: boolean
  error?: string
}

export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
}): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!key || !from) {
    console.warn(`[email] not configured (RESEND_API_KEY/EMAIL_FROM) — skipped "${opts.subject}" → ${opts.to}`)
    return { ok: false, skipped: true }
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
    })
    if (!res.ok) {
      const detail = await res.text()
      console.error(`[email] send failed (${res.status}) for "${opts.subject}":`, detail.slice(0, 300))
      return { ok: false, error: `status ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    console.error('[email] send error:', err)
    return { ok: false, error: 'exception' }
  }
}

// Best-effort fan-out; never throws (email must not break a core flow).
export async function sendEmails(
  messages: { to: string; subject: string; html: string }[],
): Promise<void> {
  await Promise.all(messages.map((m) => sendEmail(m).catch(() => undefined)))
}
