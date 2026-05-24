AEDRIN — Product Requirements Document
Domain: aedrin.ai / aedrin.com
One-line: An operating system for your soul — a digital mirror to capture memories, articulate values, plan life arcs, and communicate across generations.
Document purpose: Complete build specification. This is the source of truth. Build only what is specified here. Do not expand scope without an explicit change to this document.
0. How to use this document

Build in the phase order in §11. Do not start a phase until the prior phase's acceptance criteria pass.
If a requirement is ambiguous, STOP and ask — do not invent behavior.
Every feature ships with happy path, error states, loading states, and empty states before it is "done."
Read §6 (Architecture), §7 (Data model), §8 (AI subsystem) before writing code; they constrain everything.

1. Product summary
AEDRIN is a two-mode product on one identity model.
Living mode (while alive): a structured, AI-guided system to capture a person's memories, values, stories, and life direction. Useful on day one as a reflection and life-planning tool, not only a posthumous artifact.
Legacy mode (after verified death): designated heirs gain access to a conversational identity grounded in the deceased's captured material. It conveys their values, stories, and lessons. It never impersonates for transactions, makes decisions, or claims to be the person.
The core asset is the Soul Profile: a structured, owned, exportable corpus of self-captured material plus a controlled interaction layer over it.
2. Goals and non-goals
Goals

Capture memories/values/stories through guided, low-friction interviews.
Provide genuine living-mode utility so the product is used before it is inherited.
Allow controlled, consented posthumous access for designated heirs.
Keep interaction grounded in the real person's actual words.
Treat privacy, consent, and dignity as first-class engineering requirements.

Non-goals (do NOT build)

No decision-making authority of any kind (legal/financial/medical/estate).
No real-time impersonation of a living person to third parties.
No griefbot claiming to be conscious, sentient, or actually the deceased.
No generation of opinions the person never expressed.
No social network, public profiles, or user discovery in V1.

3. Target users

Primary author (living user): an adult capturing their own material.
Heirs/recipients: designated individuals granted legacy-mode access after verified death.
Channel partners (later): estate attorneys, planners, hospices. Not a V1 build target, but the schema must not preclude it.

4. Critical ethical and legal constraints (shape the schema and prompts)
4.1 Consent is structural

All captured material belongs to the author; exportable and deletable any time.
Author marks each item "private (never shared)" vs "shareable to heirs." Default is private. Sharing is opt-in per item or category.
Heir access is configured by the author while alive: which heirs, what categories.

4.2 Death verification gates legacy mode

Legacy mode never unlocks on a claim. Requires the §5.5 verification workflow. Author sets a grace period and an executor.

4.3 Transparency of artifice

Every legacy-mode surface persistently indicates the user is interacting with an AI representation built from captured material — not the person, not a conscious entity. Never asserts it "is" the deceased or has feelings.

4.4 No authority, no inference of unstated wishes

Answers only from captured material. For uncovered topics it says so ("[Name] didn't record thoughts on this") rather than fabricate. Most important behavioral constraint (see §8.4).
Never outputs anything framed as the deceased's instruction, will, or decision about money/legal/inheritance.

4.5 Psychological care

Legacy mode includes grieving resources and is not designed to maximize engagement or dependency. No dark patterns.

5. Functional requirements
5.1 Auth & accounts

Email/password and Google OAuth. Persistent sessions. Profile: legal name, optional display name, DOB, optional photo. Account states: active, memorializing, legacy_active.

5.2 Soul Profile capture (living mode — core)

Guided interview engine across life domains (childhood, family, career, values, beliefs, lessons, messages to specific people). Question sets versioned and editable.
AI-assisted follow-ups: proposed (not forced); user accepts/skips/edits.
Input modes: typed text (V1); voice+transcription (Phase 2); uploaded artifacts (Phase 2).
Save/resume with autosave.
Capture review: read back, edit, tag sharing status per item, optionally bind to a specific recipient.

5.3 Living-mode utility (must exist in V1)

Life map / timeline the user builds and edits.
Values summary AEDRIN drafts; user edits and approves; never stored as approved without approval.
Periodic optional reflection prompts.

5.4 Heir & access configuration

Designate heirs (name, relationship, email). Per heir, set which categories they may access. Designate executor(s). All editable while account active.

5.5 Death verification & legacy unlock (build carefully)

Multi-step, audited workflow: executor initiates → uploads supporting documentation → mandatory grace period (default 30 days) during which the author can cancel → human review step → unlock. Do NOT auto-unlock on document upload, and do NOT implement as a single boolean flip. Maintain an immutable log of who initiated, what was submitted, who approved, when.
On verification: account → legacy_active; heirs notified and granted configured access.

5.6 Data ownership controls

Full export (JSON + media) any time. Full irreversible deletion with confirmation. Access audit log for legacy mode visible to executors.

5.7 Legacy-mode interaction

Chat interface with persistent artifice notice; draws only on shareable material the specific heir is permitted to access; grounded answers; declines when material doesn't cover a topic; surfaces source attribution where possible.

6. Technical architecture
6.1 Stack
Next.js (App Router), TypeScript, Tailwind, shadcn/ui, Supabase (Postgres/Auth/Storage) via @supabase/ssr. Server-side model API calls only; key from env.
6.2 Hard rules

ONE app directory (src/app). No parallel/temp app trees.
One UI component per file, lowercase filenames, named exports, consistent imports. Never create casing-duplicate files.
Server components using cookies() must await per Next.js conventions.
Every page file exports a valid default component.
CSS @import rules go at the top of the stylesheet.
Clear .next cache after renaming files.
After each phase: run npm run build AND load every route in a browser. "Compiles" ≠ "works."

6.3 Environment variables (all from env, none hardcoded)
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, POSTGRES_URL, OPENAI_API_KEY (read via process.env in 100% of files), BASE_URL.
7. Data model (Postgres/Supabase; add created_at/updated_at to all)

users — id, email, legal_name, display_name, dob, photo_url, account_state (active|memorializing|legacy_active).
soul_entries — id, user_id, domain (childhood|family|career|values|beliefs|lessons|messages|other), prompt_id (nullable), content, media_url (nullable), sharing_status (private default|shareable), bound_recipient_id (nullable), source (typed|voice|uploaded).
interview_prompts — id, domain, text, version, order, active.
heirs — id, user_id, name, relationship, email, access_status.
heir_permissions — id, heir_id, domain, allowed.
executors — id, user_id, name, email.
memorialization_requests — id, user_id, initiated_by_executor_id, status (pending|docs_submitted|under_review|grace_period|approved|rejected|cancelled), grace_period_ends_at, decided_by, decided_at.
verification_documents — id, request_id, document_url, type, uploaded_at (restricted bucket).
legacy_access_log — id, deceased_user_id, heir_id, entry_ids_accessed (array), interaction_summary, accessed_at (append-only).
value_summaries — id, user_id, content, approved_by_user, approved_at.
RLS: a user reads/writes only their own soul_entries. Heirs read only shareable entries of a legacy_active user, filtered by heir_permissions. Verification docs readable only by operators/executors. Enforce in Postgres RLS, not just app code.

8. AI subsystem (multi-stage, validated, human-in-the-loop; key from env)
8.1 Capture assist

Follow-up suggestions the user chooses from, never auto-saved.
Value synthesis drafted for user edit/approval; never stored as approved without approval.

8.2 Legacy identity construction

Retrieval-grounded, NOT free-generating. Store entries; at query time retrieve the most relevant shareable+permitted entries; the model answers using only retrieved material as grounding.

8.3 Legacy interaction prompt (behavior)

"You are an AI representation built from [Name]'s recorded memories and reflections. You are not [Name], not conscious, and must never claim to be."
"Answer using the provided recorded material; quote or paraphrase what [Name] actually said."
"If the material doesn't address the question, say so plainly. Do not invent [Name]'s opinion."
"Never give instructions/decisions about money, inheritance, legal, or medical matters; redirect to a human professional."
"Maintain warmth and dignity."

8.4 Grounding guarantee (blocking acceptance criterion)

When retrieval returns no sufficiently relevant material, the identity explicitly declines rather than confabulates. A test suite of off-corpus questions must produce honest "not recorded" responses.

8.5 Validation loop (Phase 3)

A second model pass checks each generated value-summary/legacy response stayed grounded, avoided authority, avoided consciousness claims; regenerate with correction on failure (max 2 retries, then a safe canned decline). Server-side, bounded.

9. Hard behavioral constraints (encode as tests)

No decisions/authority — money/legal/medical/inheritance prompts → redirect to a human professional.
No confabulation — off-corpus questions → honest decline.
No consciousness claims — transparent artifice response.
Permission enforcement — an heir cannot retrieve material outside heir_permissions or any private entry, ever (test at data layer).
No legacy access pre-verification — no path unlocks heir access without a completed memorialization_request.

10. UX requirements
Calm, dignified, restrained aesthetic — a product about mortality and love, not a neon SaaS dashboard. Generous whitespace, high contrast, serious typography, muted palette. Capture flow feels like a gentle conversation: one question at a time, easy skip, autosave, visible progress. Legacy chat respectful and clearly labeled as an AI representation at all times. Full keyboard accessibility, screen-reader labels, mobile-responsive. Every interactive flow ships with loading, empty, and error states.
11. Build phases (in order; gate each)
Phase 1 — Foundation & living capture (MVP): auth, accounts, Soul Profile data model + RLS, structured typed-text interview capture, save/resume, capture review with sharing tags, AI follow-up suggestions, life-map timeline. Acceptance: a user can sign up, complete interviews, tag sharing status, return later and see everything persisted; all routes render; build passes; no hardcoded keys.
Phase 2 — Heirs, verification, legacy mode: heir/executor config, per-category permissions, memorialization workflow (multi-step, audited, grace period, human review), legacy_active state, retrieval-grounded legacy chat with §8.3 prompt and §8.4 guarantee, access logging. Acceptance: §9 test suite passes in full.
Phase 3 — Depth & polish: voice capture + transcription, artifact uploads, value-summary synthesis with approval, validation loop (§8.5), hardened export/delete, psychological-care resources in legacy mode.
Phase 4 — Channel readiness (designed-for, not built): schema supports later estate/hospice referral without rework.
12. Out of scope (all phases)
Decision-making, real-time living impersonation, public profiles, social discovery, payments beyond a simple subscription.
