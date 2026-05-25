-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 013 — Multi-Party Negotiation
--
-- Verified parties (active, can_negotiate grants) negotiate matters concerning
-- a deceased user. An AI mediator (app layer) is grounded only in the deceased's
-- recorded soul_entries and is aware of each party's identity, relationship, and
-- non-negotiables. Reads are RLS-gated to joined participants; all writes go
-- through validated server actions / API routes using the service role.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── negotiations ─────────────────────────────────────────────────────────────
create table public.negotiations (
  id                  uuid primary key default gen_random_uuid(),
  deceased_user_id    uuid not null references public.users(id) on delete cascade,
  title               text not null check (char_length(title) between 1 and 200),
  description         text check (char_length(description) <= 2000),
  status              text not null default 'open'
                        check (status in ('open','resolved','closed','archived')),
  created_by_user_id  uuid not null references public.users(id) on delete cascade,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── negotiation_participants ─────────────────────────────────────────────────
create table public.negotiation_participants (
  id                        uuid primary key default gen_random_uuid(),
  negotiation_id            uuid not null references public.negotiations(id) on delete cascade,
  participant_user_id       uuid references public.users(id) on delete set null,
  heir_id                   uuid references public.heirs(id) on delete set null,
  display_name              text not null,
  relationship_to_deceased  text not null,
  relationship_context      text,
  non_negotiables           text[] not null default '{}',
  role                      text not null default 'participant'
                              check (role in ('initiator','participant','observer')),
  consent_status            text not null default 'invited'
                              check (consent_status in ('invited','joined','declined','removed')),
  joined_at                 timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (negotiation_id, participant_user_id)
);

-- ── negotiation_messages ─────────────────────────────────────────────────────
create table public.negotiation_messages (
  id                    uuid primary key default gen_random_uuid(),
  negotiation_id        uuid not null references public.negotiations(id) on delete cascade,
  author_type           text not null check (author_type in ('participant','mediator','system')),
  author_participant_id uuid references public.negotiation_participants(id) on delete set null,
  content               text not null,
  cited_entry_ids       uuid[] not null default '{}',
  created_at            timestamptz not null default now()
);

-- ── negotiation_proposals ────────────────────────────────────────────────────
create table public.negotiation_proposals (
  id                        uuid primary key default gen_random_uuid(),
  negotiation_id            uuid not null references public.negotiations(id) on delete cascade,
  proposed_by_participant_id uuid references public.negotiation_participants(id) on delete set null,
  content                   text not null,
  status                    text not null default 'proposed'
                              check (status in ('proposed','accepted','rejected','superseded')),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- ── negotiation_proposal_responses ───────────────────────────────────────────
create table public.negotiation_proposal_responses (
  id              uuid primary key default gen_random_uuid(),
  proposal_id     uuid not null references public.negotiation_proposals(id) on delete cascade,
  participant_id  uuid not null references public.negotiation_participants(id) on delete cascade,
  response        text not null check (response in ('accept','reject','abstain')),
  comment         text,
  created_at      timestamptz not null default now(),
  unique (proposal_id, participant_id)
);

-- ── negotiation_access_log (append-only audit; service-role writes only) ──────
create table public.negotiation_access_log (
  id              uuid primary key default gen_random_uuid(),
  negotiation_id  uuid not null references public.negotiations(id) on delete cascade,
  deceased_user_id uuid not null references public.users(id) on delete restrict,
  actor_user_id   uuid not null references public.users(id) on delete restrict,
  action          text not null,
  detail          text,
  created_at      timestamptz not null default now()
);

-- ── Participation predicate (SECURITY DEFINER avoids RLS self-recursion) ──────
create or replace function public.is_negotiation_participant(neg_id uuid, uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.negotiation_participants
    where negotiation_id = neg_id
      and participant_user_id = uid
      and consent_status = 'joined'
  );
$$;

-- ── RLS: reads gated to joined participants; all writes via service role ──────
alter table public.negotiations                  enable row level security;
alter table public.negotiation_participants      enable row level security;
alter table public.negotiation_messages          enable row level security;
alter table public.negotiation_proposals         enable row level security;
alter table public.negotiation_proposal_responses enable row level security;
alter table public.negotiation_access_log        enable row level security;

create policy "negotiations: participants read"
  on public.negotiations
  for select
  using (created_by_user_id = auth.uid() or public.is_negotiation_participant(id, auth.uid()));

create policy "negotiation_participants: participants read"
  on public.negotiation_participants
  for select
  using (participant_user_id = auth.uid() or public.is_negotiation_participant(negotiation_id, auth.uid()));

create policy "negotiation_messages: participants read"
  on public.negotiation_messages
  for select
  using (public.is_negotiation_participant(negotiation_id, auth.uid()));

create policy "negotiation_proposals: participants read"
  on public.negotiation_proposals
  for select
  using (public.is_negotiation_participant(negotiation_id, auth.uid()));

create policy "negotiation_proposal_responses: participants read"
  on public.negotiation_proposal_responses
  for select
  using (exists (
    select 1 from public.negotiation_proposals pr
    where pr.id = proposal_id
      and public.is_negotiation_participant(pr.negotiation_id, auth.uid())
  ));

-- negotiation_access_log: no select/insert/update/delete policies → service role only.

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index negotiations_deceased_idx          on public.negotiations (deceased_user_id);
create index negotiations_created_by_idx         on public.negotiations (created_by_user_id);
create index neg_participants_negotiation_idx     on public.negotiation_participants (negotiation_id);
create index neg_participants_user_idx            on public.negotiation_participants (participant_user_id);
create index neg_messages_negotiation_idx         on public.negotiation_messages (negotiation_id, created_at);
create index neg_proposals_negotiation_idx        on public.negotiation_proposals (negotiation_id);
create index neg_proposal_responses_proposal_idx  on public.negotiation_proposal_responses (proposal_id);
create index neg_access_log_negotiation_idx       on public.negotiation_access_log (negotiation_id, created_at);

-- ── updated_at triggers ────────────────────────────────────────────────────────
create trigger set_updated_at before update on public.negotiations
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.negotiation_participants
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.negotiation_proposals
  for each row execute function public.set_updated_at();
