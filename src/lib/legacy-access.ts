import type { User } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import type { Domain } from '@/lib/supabase/types'

// Resolved, currently-valid access of a living user over a deceased user's
// recorded context. Centralizes the access rule so the legacy chat and the
// negotiation routes enforce it identically:
//   account legacy_active  →  heir row matches email + active
//   →  (portal grants) not expired  →  permitted domains.
export interface LegacyAccess {
  deceasedUserId: string
  deceasedName: string
  heirId: string
  allowedDomains: Domain[]
  canNegotiate: boolean
  expiresAt: string | null
}

export async function resolveLegacyAccess(
  deceasedUserId: string,
  user: User,
): Promise<LegacyAccess | null> {
  const email = user.email?.toLowerCase()
  if (!email) return null

  const service = createServiceClient()

  const { data: deceased } = (await service
    .from('users')
    .select('id, legal_name, display_name, account_state')
    .eq('id', deceasedUserId)
    .eq('account_state', 'legacy_active')
    .maybeSingle()) as {
    data: { id: string; legal_name: string; display_name: string | null; account_state: string } | null
  }
  if (!deceased) return null

  const { data: heir } = (await service
    .from('heirs')
    .select('id, access_status, verified_at, access_expires_at, can_negotiate')
    .eq('user_id', deceasedUserId)
    .eq('email', email)
    .eq('access_status', 'active')
    .maybeSingle()) as {
    data: {
      id: string
      access_status: string
      verified_at: string | null
      access_expires_at: string | null
      can_negotiate: boolean | null
    } | null
  }
  if (!heir) return null

  // Time-bound grants (portal-issued) fail closed once expired. Pre-existing
  // heirs carry a null expiry and remain governed by the active-status rule.
  if (heir.access_expires_at && new Date(heir.access_expires_at).getTime() < Date.now()) {
    return null
  }

  const { data: perms } = (await service
    .from('heir_permissions')
    .select('domain, allowed')
    .eq('heir_id', heir.id)) as {
    data: { domain: string; allowed: boolean }[] | null
  }

  const allowedDomains = (perms ?? [])
    .filter((p) => p.allowed)
    .map((p) => p.domain as Domain)

  return {
    deceasedUserId,
    deceasedName: deceased.display_name ?? deceased.legal_name,
    heirId: heir.id,
    allowedDomains,
    canNegotiate: heir.can_negotiate ?? false,
    expiresAt: heir.access_expires_at,
  }
}
