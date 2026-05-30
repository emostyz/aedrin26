-- Migration 020: milestones_sent
-- Adds a JSONB column to users for tracking which one-time milestone emails
-- have been sent (e.g. 1st_entry, 10_entries, 50_entries, 7_domains).
-- The milestones cron checks and updates this per user.

alter table public.users
  add column if not exists milestones_sent jsonb not null default '{}'::jsonb;
