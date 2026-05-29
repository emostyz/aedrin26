import crypto from 'crypto'

export interface ShareClaims {
  e: string  // entry_id
  u: string  // user_id
  x: number  // unix timestamp expiry
}

const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days

function secret(): string {
  return process.env.SHARE_TOKEN_SECRET || process.env.REPLY_TOKEN_SECRET || ''
}

export function signShareToken(
  entryId: string,
  userId: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): string | null {
  const key = secret()
  if (!key) return null

  const claims: ShareClaims = {
    e: entryId,
    u: userId,
    x: Math.floor(Date.now() / 1000) + ttlSeconds,
  }

  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const sig = crypto.createHmac('sha256', key).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyShareToken(token: string): ShareClaims | null {
  const key = secret()
  if (!key || !token) return null

  const dot = token.lastIndexOf('.')
  if (dot < 1) return null

  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)

  const expected = crypto.createHmac('sha256', key).update(payload).digest('base64url')
  if (sig.length !== expected.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null

  let claims: ShareClaims
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as ShareClaims
  } catch {
    return null
  }

  // Check expiry
  if (claims.x < Math.floor(Date.now() / 1000)) return null

  return claims
}
