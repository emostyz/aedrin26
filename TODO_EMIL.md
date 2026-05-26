# Emil's Action Items

> A living checklist of things **only you can do** — creating accounts, verifying domains, adding DNS records, providing API keys, and flipping dashboard switches. Claude builds and ships the code; these are the human steps that *activate* what's been built.
>
> Claude maintains this file: new items get added (with steps + why) the moment they come up, and items get checked off when done.

**Last updated:** 2026-05-26

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

## ⚪ Later (depends on the above)

### 4. AMP inline email box  →  *a real text box inside the email body (Gmail/Yahoo)*
**Why it matters:** This is the most literal "type inside the email" experience, layered on top of reply-to-save. It only works in Gmail/Yahoo and **requires Google to approve your sending domain as an AMP sender** — which itself requires #1 (verified domain) to be done first. We agreed to build this *after* reply-to-save is live and proven.
**Blocked by:** #1 (verified domain), then a Google AMP sender registration. Claude will build the AMP layer when you're ready.

---

## ✅ Done
- **2026-05-25** — Provided the Resend API key; email sending wired up (currently test-mode only).
