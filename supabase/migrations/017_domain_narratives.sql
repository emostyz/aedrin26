-- Per-domain "story so far" AI narrative cache
-- One row per (user, domain) combination; latest row is the active narrative.
-- Refreshed at most once per day and only when new entries exist since last generation.

create table if not exists domain_narratives (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  domain      text not null,
  content     text not null,
  entry_count int  not null default 0,
  created_at  timestamptz not null default now()
);

alter table domain_narratives enable row level security;

create policy "Users manage own domain narratives"
  on domain_narratives for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Fast lookup: latest narrative per user+domain
create index if not exists domain_narratives_user_domain_idx
  on domain_narratives (user_id, domain, created_at desc);
