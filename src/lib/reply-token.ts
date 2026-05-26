import crypto from 'crypto'

// Signed, tamper-proof token embedded in the daily email's Reply-To address
// (reply+<token>@<inbound-domain>). When the user replies, the inbound webhook
// verifies the HMAC so a sender can't forge a reply targeting another user.
export interface ReplyClaims {
  u: string // user_id
  p: string // daily_prompt_id
  d: string // domain
  dt: string // delivered_date (YYYY-MM-DD)
}

function secret(): string {
  return process.env.REPLY_TOKEN_SECRET || ''
}

export function signReplyToken(claims: ReplyClaims): string | null {
  const key = secret()
  if (!key) return null
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const sig = crypto.createHmac('sha256', key).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyReplyToken(token: string): ReplyClaims | null {
  const key = secret()
  if (!key || !token) return null
  const dot = token.lastIndexOf('.')
  if (dot < 1) return null
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = crypto.createHmac('sha256', key).update(payload).digest('base64url')
  if (sig.length !== expected.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()) as ReplyClaims
  } catch {
    return null
  }
}
