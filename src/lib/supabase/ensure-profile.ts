import type { User } from '@supabase/supabase-js'
import { createServiceClient } from './service'

// Guarantees a public.users row exists for an authenticated user.
// handle_new_user() normally creates it on signup, but a user who predates
// the trigger (or a signup where it failed) would otherwise have no row —
// breaking every FK-dependent write (soul_entries, life_events, …) and
// silently no-op'ing profile updates. This backstops that gap. It never
// overwrites an existing row, so it is safe to call on every authed entry.
export async function ensureUserProfile(user: User): Promise<void> {
  const service = createServiceClient()
  const legalName =
    (user.user_metadata?.legal_name as string | undefined)?.trim() || ''

  await service
    .from('users')
    .upsert(
      { id: user.id, email: user.email ?? '', legal_name: legalName },
      { onConflict: 'id', ignoreDuplicates: true },
    )
}
