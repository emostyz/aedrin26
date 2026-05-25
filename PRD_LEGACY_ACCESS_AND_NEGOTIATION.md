# PRD — Authorized Legacy Access & Multi-Party Negotiation

**Status:** Draft for approval
**Author:** Engineering (with Emil)
**Date:** 2026-05-24
**Scope of this document:** Two new capability areas built strictly on top of AEDRIN's existing legacy/memorialization infrastructure:

1. **Authorized Representative Verification Portal** — a self-service, security-protocol-grounded flow that lets a person *prove* they are an authorized representative of a deceased AEDRIN user and receive **scoped, time-bound, fully-audited** access to "talk to" that person's recorded context.
2. **Multi-Party Negotiation** — an AI-mediated space where multiple verified parties negotiate matters concerning the deceased, with the mediator grounded in the deceased's recorded values/wishes and aware of each party's identity, relationship, and **non-negotiables**.

> **Hard constraints (from the requester):** Build **strictly within current boundaries**. Everything must be **MECE** with the existing app — reuse existing tables/roles/patterns, add only non-overlapping new structures, and produce **zero build / TypeScript errors**. Every new query mirrors the existing security layers (auth → RLS → app filter → `assertUserOwnership` → `aiContextHeader`).

---

## 1. Background: what already exists (the foundation we build on)

AEDRIN is a "soul-capture" product. While alive, a user (the **author**) records `soul_entries` across eight life domains. They designate **heirs** (recipients, email-based, with per-domain permissions) and **executors** (trusted people who can initiate memorialization). After death, an executor uploads a death certificate, a 30-day grace period runs, an admin approves, the account flips to `legacy_active`, and heirs gain access to a **legacy chat** — a grounded AI built only from the deceased's `shareable` entries in their permitted domains, with anti-confabulation validation and an append-only audit log.

### 1.1 Existing tables this PRD reuses or extends (verbatim shapes)

| Table | Key columns | Reuse / Extend |
|---|---|---|
| `users` | `id`, `email`, `legal_name`, `display_name`, `dob`, `account_state ∈ {active, memorializing, legacy_active}`, life/work/family profile fields | **Reuse** as-is. `account_state` gates everything. |
| `soul_entries` | `user_id`, `domain ∈ {childhood,family,career,values,beliefs,lessons,messages,other}`, `content`, `sharing_status ∈ {private,shareable}`, `bound_recipient_id → heirs`, `source` | **Reuse** as the grounding corpus. |
| `heirs` | `user_id` (deceased), `name`, `relationship`, `email`, `access_status ∈ {pending,active,revoked}` | **Extend** with nullable verification/time-bound/capability columns (non-breaking). The single access principal. |
| `heir_permissions` | `heir_id`, `domain`, `allowed` (UNIQUE heir_id+domain) | **Reuse** as the per-domain scope of access. |
| `executors` | `user_id`, `name`, `email` | **Reuse** (executors may also be representatives). |
| `memorialization_requests` | `user_id`, `initiated_by_executor_email`, `status ∈ {pending,docs_submitted,grace_period,under_review,approved,rejected,cancelled}`, grace/decision fields | **Reuse** unchanged; account-death flow stays intact. |
| `verification_documents` | `request_id → memorialization_requests`, `document_url`, `type` | **Pattern reuse** (we add a parallel doc table for representative requests). |
| `legacy_access_log` | `deceased_user_id`, `heir_id`, `entry_ids_accessed uuid[]`, `interaction_summary`, `accessed_at` (append-only, service-role writes only) | **Reuse + extend pattern** for negotiation audit. |

### 1.2 Existing code patterns this PRD obeys (non-negotiable for MECE)

- **Clients:** `createClient()` (server, RLS-enforced), `createServiceClient()` (RLS-bypass, must `.eq('user_id', …)` manually), `createBrowserClient()` (client).
- **Middleware** `src/proxy.ts` refreshes auth and guards `/app/*`.
- **AI:** `getOpenAIClient()` lazy singleton, `gpt-4o` for reasoning, `gpt-4o-mini` for validation, `response_format: json_schema` for structured output, `aiContextHeader(userId)` prepended to every system prompt carrying PII, `assertUserOwnership(rows, userId, label)` before data enters any prompt.
- **Server actions:** `'use server'`, `(formData)` or `(_prevState, formData)`, return `{ error }` | `{ success: true }`, `revalidatePath()` after writes.
- **API routes:** `NextRequest/NextResponse`, 401 unauth / 400 bad input / 403 forbidden / 413 too large / 500 server, `console.error('[route]', err)`.
- **Types:** hand-written `src/lib/supabase/types.ts` (`Database.public.Tables.{table}.{Row,Insert,Update}` + exported string-union types). **We must add the 6 currently-missing table types + all new tables here or the build breaks.**
- **Design tokens:** `text-label`, `text-display`, `text-heading`, `bg-surface`, `bg-input`, `border-border`, `text-muted-foreground`, `bg-primary`, motion helpers (`FadeUp`, `FadeIn`, `Stagger`, `SlideQuestion`) from `@/components/ui/motion`.
- **Path alias:** `@/*` → `src/*`. TS `strict: true`. No implicit `any`.

---

## 2. Problem statement & motivation

1. **Access today is too narrow and not self-service.** Only people the author *pre-listed by email* can ever reach the legacy chat, and the only "approval" is an API call with an admin secret. There is no portal for a legitimate representative — a court-appointed executor, a next of kin who wasn't pre-listed, a legal representative — to *prove* their authority and obtain access. There is also no formal, user-legible **security protocol** documenting how a stranger's identity and authority are verified before they are allowed to touch a deceased person's most intimate data.
2. **Grief and estates are multi-party.** After someone dies, the people they leave behind frequently must make decisions *together* — how to honor wishes, interpret messages, divide meaningful (not necessarily monetary) things, resolve disagreements. They each arrive with a relationship, a history, and hard limits ("non-negotiables"). Today AEDRIN gives each heir a private 1:1 chat; it offers nothing for the **shared, contested** conversation. The deceased's recorded values are exactly the neutral ground that could help — if surfaced faithfully and never fabricated.

## 3. Goals & non-goals

### 3.1 Goals
- G1. A **self-service verification portal** where a representative requests access to a deceased user's context, completes an explicit **security protocol**, and — only after verification — receives access.
- G2. Access is **scoped** (per-domain, reusing `heir_permissions`), **time-bound** (expiry), **revocable**, and **audited** (every read logged).
- G3. Enterprise security principles applied end-to-end: identity verification, authority verification, explicit attestation/consent, least privilege, separation of duties (no self-approval), immutable audit, data isolation, revocation.
- G4. A **multi-party negotiation** capability: structured threads with multiple verified participants, an **AI mediator grounded in the deceased's recorded values**, awareness of each participant's **identity, relationship, and non-negotiables**, proposal/resolution tracking, and full audit.
- G5. **Zero regressions, zero build/TS errors, MECE** with the current schema and code.

### 3.2 Non-goals (explicitly out of scope for this build)
- No legal/financial/medical advice or binding legal instruments. Resolutions are *records of intent*, clearly labeled non-binding.
- No real-money transactions, asset transfers, or e-signature/notarization.
- No third-party government ID verification vendor integration (we capture documents + attestations + admin review; a vendor like Persona/Stripe Identity is a future phase, designed-for but not built).
- No email/SMS delivery infrastructure build (we record notification *intents*; actual sending is out-of-system as it is today).
- No change to the existing death-certificate memorialization flow's happy path.

## 4. Personas & roles

| Role | Who | New? | Capabilities introduced here |
|---|---|---|---|
| **Author** (deceased) | The AEDRIN user whose context is accessed | existing | Pre-set access rules & negotiation consent while alive (optional). |
| **Heir** | Pre-designated recipient | existing | Now must pass identity verification before first access; gets time-bound grants; may be flagged `can_negotiate`. |
| **Executor** | Trusted initiator of memorialization | existing | May also request representative access; may open negotiations. |
| **Authorized Representative** | A verified person granted scoped access (may or may not have been pre-listed) | **new** | Self-service request → verify → scoped/time-bound access to legacy chat + (if granted) negotiation. |
| **Negotiation Participant** | A verified party in a negotiation | **new** | Declares relationship + non-negotiables, posts messages, makes/accepts proposals. |
| **Admin / Operator** | AEDRIN staff | existing (API-only) | Reviews & approves/rejects representative access requests (separation of duties). Gains a minimal review surface. |

---

## 5. Feature 1 — Authorized Representative Verification Portal

### 5.1 The security protocol (enterprise principles → concrete steps)

A representative may only reach a deceased's context after **all** of the following, in order. Each step writes an immutable record.

1. **Authenticated requester identity.** The requester must be a signed-in AEDRIN user. Their `requester_user_id` and verified `email` are bound to the request from the auth token — never from client input (mirrors Security Layer 1).
2. **Subject + claim.** Requester identifies the deceased (by email) and states a **claimed role** (`heir | executor | legal_representative | next_of_kin | other`) and **relationship**. The system resolves the deceased account server-side.
3. **Pre-condition gate.** Access is only grantable if the deceased account is `legacy_active` (i.e., death already verified via the existing memorialization flow). Representative verification governs *who may access*, not *whether the person has died* — keeping the two protocols separate and composable.
4. **Identity & relationship evidence (no formal legal instruments).** Requester uploads *non-legal* evidence to the private `representative-documents` bucket (parallel to `verification-documents`): `government_id` (identity), `relationship_proof`, `other`. **We deliberately do NOT require true legal instruments** (court appointment, power of attorney) in this phase — that is a designed-for future addition. Same magic-byte + MIME + size validation as existing upload routes.
5. **Explicit attestation (consent & non-impersonation).** Requester must actively accept an attestation ("I attest that I am authorized…; I will not impersonate the deceased; I understand access is logged"). `attestation_accepted_at` is stamped. No pre-checked boxes, no implied consent (mirrors the app's consent-manipulation defenses).
6. **Automated risk screening with escalation (no mandatory admin review).** Instead of a human gating every request, an **NLP risk screen** (`gpt-4o-mini`) analyzes the request — claimed role vs. stated relationship, the requester's note, internal consistency, coercion/impersonation signals, and whether the requester was **pre-designated** by the author. It returns `risk_level ∈ {low, elevated, high}` + reasons. Decision:
   - **Low risk AND requester is a pre-designated heir** (email matches an existing `heirs` row) → **auto-approved**: that heir is verified + granted (the author already chose them and their domain scope).
   - **Otherwise** (not pre-designated, or `elevated`/`high` risk) → status `pending_review` → **escalated** to a human via the thin admin surface. This is the *only* path that needs admin action.
   This satisfies least-privilege + separation-of-duties precisely where it matters (the risky cases) while keeping the common, author-blessed case friction-free.
7. **Least-privilege grant.** On approval, access is granted **only** to the specific domains the author had marked for that heir (or, for non-pre-listed reps, an explicit admin-selected domain subset), via `heir_permissions`. Default deny.
8. **Time-bound + revocable.** Every grant has `access_expires_at` (default 90 days, renewable) and can be `revoked`. Expired/revoked grants fail closed at query time.
9. **Immutable audit.** Request lifecycle transitions, document uploads, approvals, every legacy-chat read, and every negotiation action are appended to audit tables with service-role-only writes.
10. **Data isolation preserved.** All AI grounding continues to pass through `assertUserOwnership(corpus, deceasedUserId, …)`; the mediator/chat never combines two people's data.

### 5.2 Request lifecycle (state machine)

```
submitted ──upload docs──▶ docs_submitted ──attest + NLP risk screen──▶ ┐
   │                                                                     │
   └────────────── cancel (by requester) ──────────────────────────────┘
            ┌─ low risk + pre-designated heir ─▶ approved (auto) ──(verify heir + grant)──▶ ACCESS LIVE
screen ────┤
            └─ not pre-designated OR elevated/high risk ─▶ pending_review ─┬─ admin approve ─▶ approved ─▶ ACCESS LIVE
                                                                           └─ admin reject  ─▶ rejected
approved ──expiry/admin/requester──▶ expired | revoked
```

### 5.3 Data model (new — migration `012`)

**`access_requests`**
- `id uuid pk default gen_random_uuid()`
- `deceased_user_id uuid NOT NULL → users(id) ON DELETE CASCADE`
- `requester_user_id uuid NOT NULL → users(id) ON DELETE CASCADE`
- `requester_email text NOT NULL`
- `claimed_role text NOT NULL CHECK (in ('heir','executor','legal_representative','next_of_kin','other'))`
- `relationship text NOT NULL`
- `message text` (optional note to reviewer)
- `status text NOT NULL DEFAULT 'submitted' CHECK (in ('submitted','docs_submitted','pending_review','approved','rejected','cancelled','expired'))`
- `attestation_accepted_at timestamptz`
- `risk_level text CHECK (in ('low','elevated','high'))` (set by the NLP screen)
- `risk_reasons text` (model's rationale, internal)
- `auto_approved boolean NOT NULL DEFAULT false`
- `decided_by text` (`'auto'` or `'admin'`), `decided_at timestamptz`, `review_notes text`
- `created_at timestamptz NOT NULL default now()`, `updated_at timestamptz NOT NULL default now()`
- **RLS:** requester reads/cancels own (`auth.uid() = requester_user_id`); insert with `WITH CHECK (auth.uid() = requester_user_id)`; status/risk transitions via service role only. Deceased's pre-death account can read requests against it (`auth.uid() = deceased_user_id`) for transparency.

**`access_request_documents`** (parallels `verification_documents`) — identity/relationship evidence only, no legal instruments
- `id`, `request_id → access_requests(id) ON DELETE CASCADE`, `document_url text NOT NULL`, `type text NOT NULL CHECK (in ('government_id','relationship_proof','other'))`, `uploaded_at timestamptz default now()`
- **RLS:** requester reads own (via join to `access_requests`); writes via service role only.

**`heirs` — additive non-breaking columns (security protocol state):**
- `verified_at timestamptz` (set when identity verification completed)
- `verification_request_id uuid → access_requests(id) ON DELETE SET NULL`
- `access_expires_at timestamptz` (time-bound; null = no expiry for legacy pre-existing rows)
- `can_negotiate boolean NOT NULL DEFAULT false`
- *(All nullable/defaulted → existing inserts and the existing legacy-chat query keep working untouched.)*

**Storage:** new private bucket `representative-documents` (10 MB cap; `application/pdf, image/jpeg, image/png, image/webp`), service-role access only — exact mirror of `verification-documents`.

### 5.4 Access enforcement (fail-closed)

The legacy-chat authorization is **extended** (not replaced) to also require, for grants created via this portal:
`heirs.access_status = 'active' AND (verified_at IS NOT NULL) AND (access_expires_at IS NULL OR access_expires_at > now())`.
Pre-existing heirs (no `verified_at`) remain governed by the current rule to avoid regressions; **new** representative grants always carry verification + expiry. A single shared server helper `resolveLegacyAccess(deceasedUserId, user)` centralizes this check and is used by both the chat route and the negotiation routes.

### 5.5 UI / routes (Feature 1)

- `/app/represent` — "Request access to someone's legacy" landing + list of the requester's own requests with live status.
- `/app/represent/new` — multi-step request flow (subject → claim/relationship → documents → attestation), reusing the onboarding step/scroll pattern (the flowing, non-clipped layout fixed earlier).
- `/app/represent/[requestId]` — status + document management + (when approved) a CTA into `/app/legacy/[deceasedUserId]`.
- `/app/admin/access-requests` — minimal admin review surface, gated by `ADMIN_SECRET` entered in a server action (no secret in client). Lists `pending_review` requests, shows docs (signed URLs), approve/reject. *(Thin; the heavy operator tooling remains external.)*

---

## 6. Feature 2 — "Talk to someone" (scoped, audited context access)

This is an **enhancement** of the existing legacy chat, not a rewrite.

- **Eligibility** now flows through `resolveLegacyAccess()` (§5.4): active + verified + unexpired grant, with domain scope from `heir_permissions`.
- **Grounding unchanged:** `shareable` entries in permitted domains only, capped, `assertUserOwnership` enforced, anti-confabulation validation loop retained.
- **New: access receipts.** Every answer continues to append to `legacy_access_log`; we surface a "who accessed what, when" view to the author (pre-death) and to admins. Grants nearing expiry show a renewal prompt.
- **New: explicit scope display.** The chat header states exactly which domains are in scope and the grant's expiry — transparency as a security feature.

No schema change beyond §5.3. The route gains the shared access helper and the verification/expiry predicate.

---

## 7. Feature 3 — Multi-Party Negotiation

### 7.1 Concept

A **negotiation** is a structured, multi-participant thread about a specific matter concerning the deceased (e.g., "How we honor Dad's request about the lake house," "Distributing the letters," "Interpreting Mom's wishes for the service"). An **AI mediator** participates: it is grounded *only* in the deceased's recorded `soul_entries` (weighted toward `values`, `beliefs`, `messages`, `family`, `lessons` domains), it knows each participant's identity / relationship / non-negotiables, and it helps the group converge — surfacing "what the recorded material actually says," proposing compromises that respect every stated non-negotiable, and explicitly flagging when the material is silent (never inventing the deceased's opinion).

### 7.2 Participant model — identity, relationship, non-negotiables

Each participant record carries:
- **Identity:** linked AEDRIN `participant_user_id` (+ verified email) — only verified parties may join (must hold an active grant for the deceased with `can_negotiate = true`).
- **Relationship:** `relationship_to_deceased` (e.g., "son") and a free-text `relationship_context` (e.g., "estranged 2014–2019; reconciled before death").
- **Non-negotiables:** `non_negotiables text[]` — each party's hard limits ("The letters stay in the family," "No decisions until my sister is present"). The mediator must treat these as constraints, never pressure a party to abandon one, and explicitly call out when two parties' non-negotiables conflict.
- **Role & consent:** `role ∈ {initiator, participant, observer}`, `consent_status ∈ {invited, joined, declined, removed}`.

### 7.3 Mediator behavior (AI design)

System prompt composition (each block prepended with `aiContextHeader(deceasedUserId)`):
1. **Identity guard:** "You are a neutral mediator. You are NOT [deceased], not conscious, and must never speak as them or invent their wishes."
2. **Recorded material:** the grounded corpus (deceased's `shareable` entries across the in-scope domains; `assertUserOwnership` enforced; capped to token budget).
3. **Participants:** each party's display name, relationship, relationship_context, and non-negotiables.
4. **Mediator rules:** cite only recorded material when representing the deceased's perspective; when material is silent, say so; honor all non-negotiables; propose options, never decree; no legal/financial/medical directives; de-escalate; surface common ground first.
5. **Validation loop** (reuse legacy-chat pattern with `gpt-4o-mini`): reject mediator outputs that (a) fabricate the deceased's wishes beyond recorded material, (b) issue binding/again legal/financial instructions, (c) claim to *be* the deceased, or (d) pressure a party to drop a non-negotiable. Up to 3 attempts → safe fallback.

### 7.4 Negotiation lifecycle

```
open ──(participants join, discuss, propose)──▶ proposals made
proposals ──each participant accept/reject──▶ when all active participants accept a proposal──▶ resolved (records agreement, non-binding)
open/proposals ──initiator or admin──▶ closed | archived
```

### 7.5 Data model (new — migration `013`)

**`negotiations`**: `id`, `deceased_user_id → users(id) ON DELETE CASCADE`, `title text NOT NULL (1–200)`, `description text (≤2000)`, `status text NOT NULL DEFAULT 'open' CHECK (in ('open','resolved','closed','archived'))`, `created_by_user_id uuid NOT NULL → users(id)`, `created_at`, `updated_at`.

**`negotiation_participants`**: `id`, `negotiation_id → negotiations(id) ON DELETE CASCADE`, `participant_user_id uuid → users(id) ON DELETE SET NULL`, `heir_id uuid → heirs(id) ON DELETE SET NULL`, `display_name text NOT NULL`, `relationship_to_deceased text NOT NULL`, `relationship_context text`, `non_negotiables text[] NOT NULL DEFAULT '{}'`, `role text NOT NULL DEFAULT 'participant' CHECK (in ('initiator','participant','observer'))`, `consent_status text NOT NULL DEFAULT 'invited' CHECK (in ('invited','joined','declined','removed'))`, `joined_at timestamptz`, `created_at`, `updated_at`. UNIQUE(`negotiation_id, participant_user_id`).

**`negotiation_messages`**: `id`, `negotiation_id → negotiations(id) ON DELETE CASCADE`, `author_type text NOT NULL CHECK (in ('participant','mediator','system'))`, `author_participant_id uuid → negotiation_participants(id) ON DELETE SET NULL`, `content text NOT NULL`, `cited_entry_ids uuid[] NOT NULL DEFAULT '{}'` (which recorded entries the mediator cited), `created_at`.

**`negotiation_proposals`**: `id`, `negotiation_id → negotiations(id) ON DELETE CASCADE`, `proposed_by_participant_id uuid → negotiation_participants(id) ON DELETE SET NULL`, `content text NOT NULL`, `status text NOT NULL DEFAULT 'proposed' CHECK (in ('proposed','accepted','rejected','superseded'))`, `created_at`, `updated_at`.

**`negotiation_proposal_responses`**: `id`, `proposal_id → negotiation_proposals(id) ON DELETE CASCADE`, `participant_id → negotiation_participants(id) ON DELETE CASCADE`, `response text NOT NULL CHECK (in ('accept','reject','abstain'))`, `comment text`, `created_at`. UNIQUE(`proposal_id, participant_id`).

**`negotiation_access_log`** (append-only audit, service-role writes only): `id`, `negotiation_id`, `deceased_user_id`, `actor_user_id`, `action text` (`viewed|posted|proposed|responded|mediator_invoked`), `detail text`, `created_at`.

**RLS principle for all negotiation tables:** a user may read/write a negotiation only if they are a `joined` participant (`EXISTS` subquery against `negotiation_participants` matching `auth.uid()`), and may only join if they hold an active, verified, unexpired grant with `can_negotiate = true` for that `deceased_user_id`. Mediator/system messages and all audit rows are written by the **service role** in API routes (RLS-bypassed but explicitly filtered), never by the client.

### 7.6 UI / routes (Feature 3)

- `/app/legacy/[deceasedUserId]/negotiations` — list of negotiations the verified user participates in + "Start a negotiation."
- `/app/legacy/[deceasedUserId]/negotiations/[id]` — the room: participant rail (names, relationships, non-negotiables), message thread (participant + mediator messages, with cited-entry chips), proposal panel (make/accept/reject), "Ask the mediator" action, resolution banner.
- Server action to declare/update **non-negotiables** and relationship context on join.

---

## 8. Consolidated new data model & TypeScript

- **Migration `012_representative_access.sql`** — `access_requests`, `access_request_documents`, `heirs` additive columns, `representative-documents` bucket + policies, indexes.
- **Migration `013_negotiation.sql`** — five `negotiation*` tables + `negotiation_access_log`, RLS, indexes.
- **`src/lib/supabase/types.ts`** — add `Row/Insert/Update` for: the **6 currently-missing** tables (`heirs`, `heir_permissions`, `executors`, `memorialization_requests`, `verification_documents`, `legacy_access_log`) **plus** all new tables, **plus** new exported unions: `ClaimedRole`, `AccessRequestStatus`, `RepDocumentType`, `NegotiationStatus`, `ParticipantRole`, `ConsentStatus`, `ProposalStatus`, `ProposalResponse`. This is prerequisite work — without it, any `.from('access_requests')` is untyped and `strict` mode fails the build.

---

## 9. Security & privacy architecture (threat model)

| Threat | Mitigation |
|---|---|
| Impostor claims to be a representative | Authenticated account + identity/relationship evidence + explicit attestation + **NLP risk screen**; only pre-designated, low-risk requests auto-approve, everything else **escalates to a human**; fail-closed default-deny; all access time-bound + revocable + audited. |
| Pre-listed heir's email compromised | Verification step (`verified_at`) + time-bound expiry + revocation; audit surfaces anomalies to author/admin. |
| Over-broad access | Least privilege: per-domain `heir_permissions`, default deny; only `shareable` entries ever enter context. |
| AI fabricates the deceased's wishes | `assertUserOwnership` + grounded-only prompt + `gpt-4o-mini` validation loop rejecting confabulation/authority/consciousness/coercion; safe fallback. |
| Cross-user data bleed | `aiContextHeader`, single-`deceased_user_id` corpus, service-client queries explicitly filtered. |
| Tampering with audit | Append-only tables, no client write path, service-role only. |
| Coercion in negotiation | Mediator rule + validator: never pressure a party to drop a non-negotiable; flag conflicts neutrally. |
| Privilege escalation via client input | All identity from `auth.getUser()`, never request body; RLS + app filters + `WITH CHECK`. |
| Document exfiltration | Private buckets, signed URLs, service-role mediated, never public. |
| Indefinite access after estate closes | Expiry + revocation; closed/archived negotiations are read-only. |

**Prohibited-action alignment:** the portal never shares/forwards data outside its audience automatically, never executes financial actions, never accepts agreements on a user's behalf — all consequential actions require the human's explicit in-product action.

## 10. API surface (new)

Server actions (`src/app/actions/representative.ts`, `negotiation.ts`):
- `createAccessRequest(formData)`, `cancelAccessRequest(id)`, `acceptAttestation(id)`
- `reviewAccessRequest(_prev, formData)` (admin-secret gated, server-side)
- `createNegotiation(formData)`, `joinNegotiation(formData)` (sets relationship + non_negotiables), `postNegotiationMessage(formData)`, `createProposal(formData)`, `respondToProposal(formData)`, `resolveNegotiation(id)`

API routes:
- `POST /api/represent/upload` — authority doc upload (mirror of `/api/memorialization/upload`).
- `POST /api/negotiation/mediate` — invoke grounded mediator (mirror of `/api/legacy/chat` structure: resolve access → assert ownership → mediate → validate loop → log).

All mirror existing auth/validation/error conventions exactly.

## 11. MECE alignment & integration map

- **No table or column is redefined.** New tables are disjoint; `heirs` gains only additive nullable/defaulted columns.
- **Single access principal** remains `heirs` + `heir_permissions`; the portal feeds into it rather than creating a parallel principal.
- **Death verification** stays in `memorialization_requests`; **identity/authority verification** is the new, separate `access_requests` — composable, non-overlapping responsibilities.
- **Legacy chat** is extended via one shared helper; its existing behavior for current heirs is unchanged.
- **Audit** reuses the append-only/service-role pattern.
- **Types** are extended in the one source-of-truth file before any feature code references new tables.

## 12. Build plan (phased; each phase ends green: `npm run build` passes, no TS errors)

- **Phase 0 — Types backfill.** Add the 6 missing + scaffold new table types and unions in `types.ts`. *(Unblocks everything; no behavior change.)*
- **Phase 1 — Migrations.** `012` + `013` written and applied to the hosted DB (mirroring how earlier migrations were applied), plus the new storage bucket.
- **Phase 2 — Representative portal (Feature 1).** Upload route, actions, `/app/represent/*` pages, admin review surface, `resolveLegacyAccess()` helper.
- **Phase 3 — Legacy-chat enhancement (Feature 2).** Wire the access helper + expiry/scope display + receipts. Verify no regression for existing heirs.
- **Phase 4 — Negotiation (Feature 3).** Tables already in `013`; build actions, `/mediate` route + mediator prompt/validator, negotiation room UI, proposals/resolution.
- **Phase 5 — Hardening & verification.** Full `npm run build`; browser walkthrough of each new flow via the preview tool with throwaway accounts (created/deleted via admin API, as done previously); audit-log spot checks; commit + deploy per phase.

## 13. Edge cases & failure modes
- Deceased not yet `legacy_active` → request allowed to be drafted but access cannot go live until death is verified (clear messaging).
- Requester already an active heir → fast-path eligibility, still requires attestation.
- Grant expired mid-session → next read fails closed with a renewal prompt.
- Negotiation participant loses access (revoked/expired) → removed from active participation; historical messages retained, no new posts.
- Mediator corpus empty (deceased shared nothing in scope) → mediator declines to represent the deceased's view, still facilitates process neutrally.
- Conflicting non-negotiables with no overlap → mediator states the impasse plainly; no forced resolution.

## 14. Decisions (confirmed 2026-05-24)
1. **Negotiation depth — DECIDED: full mediation.** Multi-party thread + AI mediator + proposals/accept-reject + non-binding recorded resolution.
2. **Approval model — DECIDED: automated, escalation-only.** No formal legal instruments and **no mandatory admin review.** Identity/relationship evidence + attestation, then an **NLP risk screen** auto-approves the low-risk, author-pre-designated case and **escalates** only non-pre-designated or risky requests to a human. NLP escalation also applies inside negotiations (flag high-conflict/legal-threat/safety situations for human attention).
3. **Access principal — DECIDED: extend `heirs`** (single principal) rather than a separate `representatives` table — keeps legacy chat MECE.
4. **Binding-ness — DECIDED: non-binding records of intent** (no legal/financial execution).
5. **Build — DECIDED: all phases, shipped phase-by-phase**, green build at each step.

## 15. Success criteria
- A verified, non-pre-listed representative can, end-to-end, request → verify → be approved → talk to the deceased's grounded context, with every read audited and access expiring.
- Two+ verified parties can run a negotiation where the mediator cites only recorded material, honors every non-negotiable, and a resolution is recorded once all accept.
- `npm run build` is green; no TypeScript errors; existing heir/legacy/memorialization flows unchanged.
