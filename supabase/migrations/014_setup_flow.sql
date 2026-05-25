-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 014 — First-run guided setup flag
--
-- After onboarding, brand-new users get a short guided "set up your account"
-- flow of foundational reflection questions before the daily cadence begins.
-- Existing users predate this feature and should not be shown it.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.users add column if not exists setup_complete boolean not null default false;

-- Everyone who already exists has been using the app — don't surprise them.
update public.users set setup_complete = true;
