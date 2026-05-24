/**
 * AI Data Guard
 *
 * Runtime enforcement of user data isolation for AI contexts.
 *
 * Why this exists
 * ───────────────
 * Supabase Row Level Security (RLS) enforces ownership at the database layer,
 * but server actions that use the service-role client bypass RLS by design
 * (e.g. reading prompt history or insight history across the insert boundary).
 *
 * If a `.eq('user_id', userId)` filter were accidentally removed from a
 * service-client query, RLS would NOT catch it — the wrong user's rows would
 * silently enter the AI context. These guards catch that at the application
 * layer before any data reaches OpenAI.
 *
 * Defence-in-depth layer order:
 *   1. Auth token   — user.id comes from supabase.auth.getUser(), not client input
 *   2. RLS          — database-level enforcement on all user-client queries
 *   3. App filter   — .eq('user_id', user.id) on every query (including service client)
 *   4. THIS MODULE  — runtime ownership assertion before data enters AI context
 *   5. AI prompt    — explicit user_id binding in every system prompt that includes PII
 */

/**
 * Asserts that every record in the array belongs exclusively to `userId`.
 *
 * Call this after any service-client query that fetches rows before they are
 * included in an AI prompt. Throws immediately on the first violation so no
 * cross-user data ever reaches OpenAI.
 *
 * @param records   Array of rows returned from the database
 * @param userId    The authenticated user's ID (from supabase.auth.getUser())
 * @param context   Human-readable label for log attribution (e.g. 'daily-prompt/entries')
 *
 * @throws Error – if any record.user_id !== userId
 */
export function assertUserOwnership<T extends { user_id: string }>(
  records: T[],
  userId: string,
  context: string,
): void {
  for (const record of records) {
    if (record.user_id !== userId) {
      // Log without emitting the full record — avoid PII in error logs
      console.error(
        `[AI Guard] OWNERSHIP VIOLATION in ${context}: ` +
        `record.user_id does not match authenticated userId=${userId}. ` +
        `Aborting AI call.`,
      )
      throw new Error(
        `[AI Guard] Data isolation error in ${context}: a record that does not ` +
        `belong to the authenticated user was about to enter the AI context. ` +
        `This incident has been logged.`,
      )
    }
  }
}

/**
 * Filters records to only those belonging to `userId`, logging any violations.
 *
 * Use this variant when you want to continue with a partial dataset rather
 * than abort entirely — e.g. non-critical supplementary context. Prefer
 * `assertUserOwnership` for primary data sources.
 */
export function filterToUserOwned<T extends { user_id: string }>(
  records: T[],
  userId: string,
  context: string,
): T[] {
  const owned = records.filter((r) => r.user_id === userId)
  const violations = records.length - owned.length
  if (violations > 0) {
    console.error(
      `[AI Guard] OWNERSHIP FILTER in ${context}: discarded ${violations} ` +
      `record(s) that did not belong to userId=${userId}.`,
    )
  }
  return owned
}

/**
 * Returns an internal header to embed at the top of every AI system prompt
 * that includes user-specific data.
 *
 * This makes the user context explicit in the prompt so the model cannot
 * accidentally blend data from different users (important if context ever
 * includes cached or multi-user batch content). The header is internal —
 * never shown to end users.
 *
 * @param userId  The authenticated user's ID
 */
export function aiContextHeader(userId: string): string {
  return (
    `[INTERNAL — DATA ISOLATION CONTRACT]\n` +
    `All personal data in this prompt belongs exclusively to user_id=${userId}.\n` +
    `You MUST NOT reference, infer, or combine data from any other user.\n` +
    `If asked about another person's private information, decline.\n\n`
  )
}
