-- 006: Daily AI insights — pattern-based, non-repeating, one per user per day

create table if not exists public.daily_insights (
  id               uuid      primary key default gen_random_uuid(),
  user_id          uuid      not null references public.users(id) on delete cascade,
  insight_text     text      not null,
  recommendation   text,                       -- nullable: only when appropriate
  pattern_sources  text[]    not null default '{}', -- domains referenced
  delivered_date   date      not null,
  created_at       timestamptz not null default now(),
  unique (user_id, delivered_date)
);

alter table public.daily_insights enable row level security;

create policy "own daily insights: select"
  on public.daily_insights for select
  using (auth.uid() = user_id);

-- Inserts via service role, which bypasses RLS.
