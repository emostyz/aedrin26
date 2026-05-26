# Before Production

Open items that must be resolved before this handles real user data at scale.
Update this file as things are completed or discovered.

---

## 🔴 Security (blockers)

### Rate limiting on AI endpoints
Every call to `/api/legacy/chat`, `/app/actions/daily-prompt`, `/app/actions/daily-insight`,
and `/app/actions/ai` (follow-ups) triggers one or more GPT-4o completions. A single
malicious or misconfigured client can run up unbounded OpenAI costs.

**Fix:** Add [Upstash Rate Limit](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)
(Redis-backed, works in serverless). Suggested limits:
- `daily-prompt` / `daily-insight`: 5 req/user/day
- `suggestFollowUps`: 30 req/user/hour
- `/api/legacy/chat`: 20 req/heir/hour

**Why not done yet:** Needs a Redis instance. Upstash has a free tier — set it up at
`upstash.com`, add `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` to env,
then wrap the action/route handlers.

---

### ~~Content Security Policy (CSP)~~ ✅ Done 2026-05-26
Implemented in `src/proxy.ts`. Nonce-based `script-src`; `unsafe-eval` dev-only.
Supabase host, WSS, and Google accounts allowlisted in `connect-src`.

---

### ~~Artifact display uses private bucket without signed URLs~~ ✅ Done 2026-05-26
`GET /api/artifacts/signed?path=...` added. Authenticated; enforces path ownership
(`path` must start with `{userId}/`); returns a 1-hour signed URL.

---

### Admin secret must be set in production environment
`ADMIN_SECRET` is in `.env.local` only. It will not be present in Vercel/production
unless explicitly added to the deployment environment variables.

**Fix:** Add `ADMIN_SECRET` to Vercel → Settings → Environment Variables before deploy.
Use the value from `.env.local` (or rotate it and use a new one for prod).

---

### Application-layer encryption for most sensitive fields
`biggest_regret`, `life_purpose`, `life_description` are stored in plaintext in the
`users` table. If Supabase's infrastructure were compromised, this data would be exposed.

**Fix (optional but recommended for a grief/end-of-life product):** Encrypt these fields
client-side or in the server action before writing, using a KMS-managed key
(AWS KMS, Vercel's encrypted env, or Supabase Vault). Tradeoff: encrypted fields
can't be searched or filtered server-side.

---

## 🟡 Infrastructure

### ADMIN_SECRET rotation policy
The 64-char hex secret generated on 2026-05-24 is in `.env.local`. If it's ever
committed to git, printed to logs, or exposed in an error, rotate it immediately:
```bash
openssl rand -hex 32
# Update .env.local and production env vars
```

### Production database backups
Supabase Free tier has no PITR. Supabase Pro ($25/mo) includes daily backups + PITR.
Enable before going live.

### Enable Supabase Google OAuth
Currently returns "Unsupported provider" when users click "Continue with Google".
**Fix:** Supabase Dashboard → Authentication → Providers → Google → add OAuth credentials
from [Google Cloud Console](https://console.cloud.google.com/).

### Monitoring and error alerting
No error tracking is configured. Unhandled exceptions in server actions and API routes
currently log to the console only.

**Fix:** Add [Sentry for Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
or Vercel's built-in log drain. Minimum: capture 5xx errors and AI generation failures.

### Storage lifecycle / cleanup
Uploaded artifacts in the `artifacts` bucket have no expiry. Storage will grow unboundedly.
**Fix:** Add a Supabase Edge Function or cron job to delete orphaned artifacts (not
referenced by any `soul_entries.media_url`) older than 30 days.

---

## 🟡 Legal / Compliance

### Terms of Service and Privacy Policy
Required before real users can sign up. This product handles end-of-life, grief,
and biometric (voice) data. The privacy policy must cover:
- What data is collected and why
- How soul entries are used for AI generation
- Data retention and deletion rights
- Third-party processors: Supabase (storage + auth), OpenAI (AI generation), Vercel (hosting)
- GDPR / CCPA rights (access, export, deletion)

### ~~Account deletion must remove storage files~~ ✅ Done 2026-05-26
`deleteAccount` now lists and removes all files in `avatars/{userId}/` and
`artifacts/{userId}/` before calling `auth.admin.deleteUser`.

### ~~GDPR data export completeness~~ ✅ Done 2026-05-26
Export now includes `daily_prompts`, `daily_insights`, and `memorialization_history`.
Schema version bumped to `1.1`.

---

## 🟢 UX / Feature gaps (pre-launch polish)

### ~~Email confirmation flow~~ ✅ Done 2026-05-26
`/auth/confirm` page added with branded styling and resend button. Signup now
detects whether email confirmation is required (session null check) and redirects
there automatically. Confirmation disabled in Supabase → still goes straight to onboarding.

### Email notifications
No transactional emails are sent for: legacy access granted, memorialization request
status change, heir accepted invitation. Need a provider (Resend, SendGrid) + templates.

### Onboarding can be re-triggered
If a user somehow lands on `/onboarding` after completing it, the page redirects them
to the dashboard — which is correct. But there's no way for a user to update their
intake answers from Settings. Add an "Edit profile context" section in `/app/profile`.

### ~~Daily prompt / insight timing~~ ✅ Done 2026-05-26
`getOrCreateTodaysPrompt` now falls back to a date-seeded static `interview_prompt`
when OpenAI fails. Same question shows all day; gracefully degrades.
