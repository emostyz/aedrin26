-- 005: Intake profile fields + daily AI prompts

-- ── Intake columns on users ─────────────────────────────────────────────────
alter table public.users
  add column if not exists relationship_status text,
  add column if not exists location           text,
  add column if not exists life_description   text,
  add column if not exists biggest_regret     text,
  add column if not exists life_purpose       text,
  add column if not exists onboarding_complete boolean not null default false;

-- ── daily_prompts ────────────────────────────────────────────────────────────
-- One AI-generated prompt per user per calendar day.
-- unique(user_id, delivered_date) enforces at most one prompt per day.
create table if not exists public.daily_prompts (
  id             uuid      primary key default gen_random_uuid(),
  user_id        uuid      not null references public.users(id) on delete cascade,
  prompt_text    text      not null,
  domain         text      not null,
  rationale      text      not null,  -- why this prompt was chosen (for internal insight)
  delivered_date date      not null,
  soul_entry_id  uuid      references public.soul_entries(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (user_id, delivered_date)
);

alter table public.daily_prompts enable row level security;

create policy "own daily prompts: select"
  on public.daily_prompts for select
  using (auth.uid() = user_id);

create policy "own daily prompts: update"
  on public.daily_prompts for update
  using (auth.uid() = user_id);

-- Insert is done server-side via service role (bypasses RLS) — no insert policy needed.
