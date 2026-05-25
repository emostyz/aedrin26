-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 015 — Notification preferences
--
-- Backs the engagement layer: a per-user toggle for the daily reflection
-- reminder, and a guard so the cron never emails the same person twice in a day.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.users add column if not exists reminders_enabled boolean not null default true;
alter table public.users add column if not exists last_reminded_on date;
