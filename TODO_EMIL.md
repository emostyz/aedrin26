# Emil's Action Items

> A living checklist of things **only you can do** — creating accounts, verifying domains, adding DNS records, providing API keys, and flipping dashboard switches. Claude builds and ships the code; these are the human steps that *activate* what's been built.
>
> Claude maintains this file: new items get added (with steps + why) the moment they come up, and items get checked off when done.

**Last updated:** 2026-05-29 (evening)

---

## 🔴 Open — do these to unlock features that are already built & deployed

### 1. Verify `aedrin.com` in Resend  →  *unblocks email reaching real users, and sending from @aedrin.com*
**Why it matters:** Right now Resend is in **test mode**, which only delivers email to your own address (`ermostrom@gmail.com`). That means your real users — like `jordan@notyourdadsmedia.com` — currently receive **nothing**: no daily reflection reminders, no heir-access notices, none of it. Verifying the domain is the single switch that turns the whole notification layer on for everyone. It's the highest-impact item on this list.

**Steps:**
1. Go to **Resend → Domains → Add Domain** and enter `aedrin.com`.
2. Resend shows you a set of DNS records (an SPF `TXT`, a DKIM `TXT`/`CNAME`, and a return-path `CNAME`).
3. Add those records in **Google Cloud DNS** for the `aedrin.com` zone (same place you changed the `www` CNAME before).
4. Back in Resend, wait until the domain shows **Verified** (usually minutes, can take up to ~an hour).
5. In **Vercel → Project → Settings → Environment Variables (Production)**, change `EMAIL_FROM` to `AEDRIN <hello@aedrin.com>` (or any `@aedrin.com` address), then **redeploy**.

**Done when:** a test email from the app arrives at a non-`ermostrom` address (e.g. send yourself one from another inbox).

---

### 2. Turn on Resend **Inbound** + register the webhook  →  *unblocks "reply-to-save" (answer the daily email by replying to it)*
**Why it matters:** The feature that lets someone write their daily reflection by simply **replying to the email** is fully built and tested, but it's dormant until Resend is set up to *receive* mail and hand it to the app. Without this, the daily email's "reply to save" option won't appear and replies go nowhere.

**Steps:**
1. **Resend → Inbound** → enable receiving. Two options:
   - *Easiest:* use a managed **`<name>.resend.app`** receiving address (needs no DNS — and works even before #1 is done, so you can test it with your own account first), **or**
   - add **MX records** for a subdomain like `reply.aedrin.com` in Google Cloud DNS.
2. Register an inbound **webhook** pointing to: `https://www.aedrin.com/api/inbound/email`. Copy the **signing secret** it gives you.
3. In **Vercel → Environment Variables (Production)**, set:
   - `RESEND_WEBHOOK_SECRET` = the signing secret from step 2
   - `RESEND_INBOUND_DOMAIN` = your receiving domain (e.g. `<name>.resend.app` or `reply.aedrin.com`)
   - Make sure `RESEND_API_KEY` is a **full-access** key — the current one is *send-only* and can't read incoming email bodies. (Create a full-access key in Resend → API Keys and replace it.)
4. **Redeploy.**

**Done when:** you reply to a daily reminder email and the reflection appears in your journal automatically.
*(Note: `REPLY_TOKEN_SECRET` and `CRON_SECRET` are already set by Claude — you don't need to touch those.)*

---

### 3. *(Optional)* Enable Google sign-in  →  *adds a "Continue with Google" button*
**Why it matters:** The button is built but hidden, so there's no half-working button in the meantime. Turning it on is a nice-to-have that lowers signup friction.

**Steps:**
1. Create an **OAuth client** in **Google Cloud Console** (type: Web application).
2. In **Supabase → Authentication → Providers → Google**, paste the client ID + secret and add the redirect URL Supabase shows.
3. In **Vercel → Environment Variables**, set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`, then **redeploy**.

**Done when:** the "Continue with Google" button appears on the login/signup pages and signs you in.

---

### 5. Disable email confirmation in Supabase  →  *eliminates the biggest signup dropoff*
**Why it matters:** Right now, new users hit a "check your inbox" wall immediately after signing up. Many never come back. Disabling email confirmation means users get taken straight to onboarding without waiting for an email — the account creation is instant. This is the single highest-impact change you can make to signup conversion.

**Steps:**
1. Go to **Supabase → Authentication → Providers → Email**.
2. Toggle **Confirm email** to **OFF**.
3. Save.

That's it — no code change needed. After this, new signups will land directly on the onboarding flow instead of the "check your inbox" page.

**Done when:** You sign up with a test account and land directly on the onboarding flow with no email required.

---

### ~~6. Run the custom questions migration in Supabase~~  ✅ Done by Claude 2026-05-29
**Why it matters:** Users can now add their own interview questions to any capture domain. The code and UI are fully built, but the `custom_questions` database table needs to be created first — otherwise saving a custom question will fail silently.

**Steps:**
1. Go to **Supabase → SQL Editor → New query**.
2. Paste and run the contents of `supabase/migrations/016_custom_questions.sql` (it's in your repo).
3. Click **Run**.

**Done when:** You can add a custom question in Capture and it persists on reload.

---

### 7. Create the `avatars` storage bucket in Supabase  →  *unblocks profile photo upload*
**Why it matters:** The profile photo upload UI is built and the code is wired up correctly, but it fails if the `avatars` storage bucket doesn't exist in Supabase. If you've already created it, you can skip this step.

**Steps:**
1. Go to **Supabase → Storage → New bucket**.
2. Name it `avatars`.
3. Check **Public bucket** (profile photos are served as public URLs, so this is fine — the path includes the user's UUID which provides sufficient obscurity).
4. Save.

**Done when:** Uploading a photo on your profile page succeeds and displays the image.

---

### 4. Set `ADMIN_EMAIL` in Vercel  →  *unblocks grace-period admin alerts*
**Why it matters:** When a memorialization grace period expires the cron job sends you an alert email so you know to log in and review the request. Without `ADMIN_EMAIL` set, those alerts are silently skipped.

**Steps:**
1. Go to **Vercel → aedrin26 project → Settings → Environment Variables**.
2. Add a new variable: `ADMIN_EMAIL` = `ermostrom@gmail.com` (or any inbox you check).
3. Set it for **Production** only → Save → **Redeploy**.

**Done when:** you receive a test alert (you can trigger one manually via `curl -H "Authorization: Bearer $CRON_SECRET" https://www.aedrin.com/api/cron/grace-period-check`).

---

### ~~8. Run the domain narratives migration in Supabase~~  ✅ Done by Claude 2026-05-29
**Why it matters:** Each domain page (Childhood, Family, Career, etc.) now shows an AI-written narrative of everything you've captured in that area — like a running memoir chapter. The code is built but the `domain_narratives` database table needs to be created first.

**Steps:**
1. Go to **Supabase → SQL Editor → New query**.
2. Paste and run the contents of `supabase/migrations/017_domain_narratives.sql` (it's in your repo).
3. Click **Run**.

**Done when:** After capturing 3+ entries in any domain, you see a "Your story so far" narrative card at the top of that domain's page.

---

### ~~10. Run the prompt theme-tag migration in Supabase~~  ✅ Done by Claude 2026-05-29
**Why it matters:** The daily prompt system now uses a library of 64 distinct life-story topics and guarantees that no topic repeats within a 30-day window. Before this change, the AI could accidentally ask similar questions week after week. After this migration, each prompt is tagged with a specific topic ID (`theme_tag`), and the app blocks that topic for 30 days before cycling it back. This makes the daily reflection feel fresh and covers more ground over time.

**Steps:**
1. Go to **Supabase → SQL Editor → New query**.
2. Paste and run the contents of `supabase/migrations/018_prompt_theme_tags.sql` (it's in your repo — it just adds a single nullable column).
3. Click **Run**.

**Done when:** You see the column `theme_tag` in the `daily_prompts` table in Supabase.

*(Note: existing prompt rows will have `theme_tag = null` — that's fine. Only new prompts generated after this migration will have the tag.)*

---

### ~~11. Run the gift-invitations migration in Supabase~~  ✅ Done by Claude 2026-05-29
**Why it matters:** This is the foundation of the **gift loop** — the single biggest move from "personal journaling app" to "category-winning intergenerational memory product." It lets one user (e.g. you) invite a parent, grandparent, or anyone whose story matters to them, via a personal email with a one-click claim link. The recipient signs up, the two accounts get linked, and you'll later receive a quarterly digest of what they've shared. The code, the email template, the sender form, the recipient claim page, and the auth handoff are all built. The `gift_invitations` table just needs to exist before any of it works.

**Steps:**
1. Go to **Supabase → SQL Editor → New query**.
2. Paste and run the contents of `supabase/migrations/019_gift_invitations.sql` (it's in your repo).
3. Click **Run**.

**Done when:** You can go to `/app/gift` (linked from Settings), fill in the form for any email address you own, and receive the personal invitation email at that address.

*(Note: For real gift emails to land in someone else's inbox you also need item #1 — verified Resend domain. Without that, only emails to `ermostrom@gmail.com` will actually arrive; everything else gets silently skipped in test mode.)*

---

### 9. Create PWA app icons  →  *lets users install AEDRIN as a native-feeling app on their phone*
**Why it matters:** The code for making AEDRIN installable as a Progressive Web App (PWA) is now in place — users on iPhone and Android can "Add to Home Screen" and get a full-screen, no-browser-chrome experience just like a real app. But the icon files (the image that appears on your home screen and loading screen) need to be created and placed in the right spot.

**Steps:**
1. Open `/public/icon.svg` in your repo — it's a dark background with a white "A" that you can use as your starting point, or replace with a proper icon design.
2. Export the SVG at two sizes: **192×192 pixels** and **512×512 pixels**, saved as PNG files.
3. Name them exactly:
   - `public/icons/icon-192.png`
   - `public/icons/icon-512.png`
4. Commit those two files and deploy.

**Optional but recommended:** Use a tool like [RealFaviconGenerator](https://realfavicongenerator.net) or Figma to export a polished icon set. Upload your icon there and it will create all the sizes you need (including iOS-specific ones).

**Done when:** On an iPhone, go to `aedrin.com` in Safari → tap the Share button → "Add to Home Screen" → the AEDRIN icon appears on your home screen, and opening it shows the app full-screen with no browser UI.

---

## ⚪ Later (depends on the above)

### 4. AMP inline email box  →  *a real text box inside the email body (Gmail/Yahoo)*
**Why it matters:** This is the most literal "type inside the email" experience, layered on top of reply-to-save. It only works in Gmail/Yahoo and **requires Google to approve your sending domain as an AMP sender** — which itself requires #1 (verified domain) to be done first. We agreed to build this *after* reply-to-save is live and proven.
**Blocked by:** #1 (verified domain), then a Google AMP sender registration. Claude will build the AMP layer when you're ready.

---

## ✅ Done
- **2026-05-25** — Provided the Resend API key; email sending wired up (currently test-mode only).
