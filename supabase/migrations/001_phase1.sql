-- Phase 1 schema: users, soul_entries, interview_prompts, value_summaries, life_events

-- ─── users ────────────────────────────────────────────────────────────────────
-- Extends auth.users with profile fields. One row per authenticated user.
create table public.users (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  legal_name   text not null,
  display_name text,
  dob          date,
  photo_url    text,
  account_state text not null default 'active'
                check (account_state in ('active', 'memorializing', 'legacy_active')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users: own row only"
  on public.users
  for all
  using  (auth.uid() = id)
  with check (auth.uid() = id);

-- ─── interview_prompts ────────────────────────────────────────────────────────
-- Versioned, ordered set of questions per domain. Managed by operators.
create table public.interview_prompts (
  id         uuid primary key default gen_random_uuid(),
  domain     text not null
               check (domain in ('childhood','family','career','values','beliefs','lessons','messages','other')),
  text       text not null,
  version    integer not null default 1,
  ord        integer not null default 0,  -- "order" is a reserved word
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prompts are readable by all authenticated users; only operators write them.
alter table public.interview_prompts enable row level security;

create policy "interview_prompts: authenticated read"
  on public.interview_prompts
  for select
  using (auth.role() = 'authenticated');

-- ─── soul_entries ─────────────────────────────────────────────────────────────
-- Free-form captured reflections tied to interview prompts.
-- This is the corpus the legacy identity retrieves from in Phase 2.
create table public.soul_entries (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  domain              text not null
                        check (domain in ('childhood','family','career','values','beliefs','lessons','messages','other')),
  prompt_id           uuid references public.interview_prompts(id) on delete set null,
  content             text not null,
  media_url           text,
  sharing_status      text not null default 'private'
                        check (sharing_status in ('private','shareable')),
  bound_recipient_id  uuid,  -- nullable FK to heirs; added as FK in Phase 2
  source              text not null default 'typed'
                        check (source in ('typed','voice','uploaded')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.soul_entries enable row level security;

create policy "soul_entries: own rows only"
  on public.soul_entries
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── value_summaries ─────────────────────────────────────────────────────────
-- AI-drafted value summaries. Never stored as approved without explicit user action.
create table public.value_summaries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  content          text not null,
  approved_by_user boolean not null default false,
  approved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.value_summaries enable row level security;

create policy "value_summaries: own rows only"
  on public.value_summaries
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── life_events ─────────────────────────────────────────────────────────────
-- Chronological scaffold the user arranges on their timeline.
-- Kept separate from soul_entries (different structure: date/sequence-first).
-- A nullable life_event_id FK on soul_entries can link them in a later phase.
create table public.life_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  title       text not null,
  event_date  date,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.life_events enable row level security;

create policy "life_events: own rows only"
  on public.life_events
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── updated_at triggers ─────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.interview_prompts
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.soul_entries
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.value_summaries
  for each row execute function public.set_updated_at();

create trigger set_updated_at before update on public.life_events
  for each row execute function public.set_updated_at();

-- ─── auto-create user profile on signup ──────────────────────────────────────
-- Inserts a row in public.users whenever auth.users gets a new row.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, legal_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'legal_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
