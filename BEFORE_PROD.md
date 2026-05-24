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

### Content Security Policy (CSP)
No CSP header is set. Prevents XSS escalation but requires nonce-based implementation
to work alongside Supabase realtime, Framer Motion, and inline scripts Next.js injects.

**Fix:** Add CSP middleware at `src/middleware.ts` using `next/headers` + a per-request
nonce. Reference: [Next.js CSP docs](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy).

---

### Artifact display uses private bucket without signed URLs
The `artifacts` bucket is private (good), but the stored `media_url` in `soul_entries`
is a raw storage URL that won't render in `<img>` or `<a>` tags without auth headers.
Attachments are currently broken for display.

**Fix:** 
1. Store only the storage **path** (not full URL) in `soul_entries.media_url`
2. Add `GET /api/artifacts/signed?path=...` — authenticated, generates a 1-hour signed
   URL via `service.storage.from('artifacts').createSignedUrl(path, 3600)`
3. Replace any display of `media_url` in the UI with a call to this endpoint

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

### Account deletion must remove storage files
The delete account flow (`/app/settings/delete`) removes the DB row (cascades to
soul_entries, etc. via FK) but does NOT delete files from `avatars/` and `artifacts/`
buckets in Supabase Storage.

**Fix:** In the delete account server action, before deleting the auth user, call
`service.storage.from('avatars').remove([...])` and `service.storage.from('artifacts').list(userId)` + remove all files.

### GDPR data export completeness
The current `/api/export` returns soul entries, profile, heirs, executors. It does NOT
include: daily_prompts, daily_insights, life_events, memorialization history.

**Fix:** Add the missing tables to the export payload so users can receive a complete
copy of all their data.

---

## 🟢 UX / Feature gaps (pre-launch polish)

### Email confirmation flow
New users who sign up with email/password receive a confirmation email (Supabase default)
but there's no styled confirmation page or resend flow in the app.

### Email notifications
No transactional emails are sent for: legacy access granted, memorialization request
status change, heir accepted invitation. Need a provider (Resend, SendGrid) + templates.

### Onboarding can be re-triggered
If a user somehow lands on `/onboarding` after completing it, the page redirects them
to the dashboard — which is correct. But there's no way for a user to update their
intake answers from Settings. Add an "Edit profile context" section in `/app/profile`.

### Daily prompt / insight timing
Prompts and insights are generated lazily on first dashboard load each day. If generation
fails (OpenAI outage), the user sees nothing. Add a graceful fallback: surface one of
the static `interview_prompts` seed questions for the day instead.
