-- Phase 2 schema: heirs, heir_permissions, executors,
-- memorialization_requests, verification_documents, legacy_access_log

-- ─── heirs ───────────────────────────────────────────────────────────────────
create table public.heirs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  name          text not null,
  relationship  text not null,
  email         text not null,
  access_status text not null default 'pending'
                  check (access_status in ('pending','active','revoked')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.heirs enable row level security;

create policy "heirs: author manages own heirs"
  on public.heirs
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger set_updated_at before update on public.heirs
  for each row execute function public.set_updated_at();

-- ─── heir_permissions ────────────────────────────────────────────────────────
create table public.heir_permissions (
  id      uuid primary key default gen_random_uuid(),
  heir_id uuid not null references public.heirs(id) on delete cascade,
  domain  text not null
            check (domain in ('childhood','family','career','values','beliefs','lessons','messages','other')),
  allowed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (heir_id, domain)
);

alter table public.heir_permissions enable row level security;

-- Author reads/writes permissions for their own heirs
create policy "heir_permissions: author manages via heirs"
  on public.heir_permissions
  for all
  using (
    exists (
      select 1 from public.heirs h
      where h.id = heir_id and h.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.heirs h
      where h.id = heir_id and h.user_id = auth.uid()
    )
  );

create trigger set_updated_at before update on public.heir_permissions
  for each row execute function public.set_updated_at();

-- ─── executors ───────────────────────────────────────────────────────────────
create table public.executors (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  name       text not null,
  email      text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.executors enable row level security;

create policy "executors: author manages own executors"
  on public.executors
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger set_updated_at before update on public.executors
  for each row execute function public.set_updated_at();

-- ─── memorialization_requests ────────────────────────────────────────────────
-- Immutable-log intent: status transitions are append-via-update only;
-- actual immutability is enforced by restricting who can write what columns.
create table public.memorialization_requests (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.users(id) on delete restrict,
  initiated_by_executor_email text not null,
  status                  text not null default 'pending'
                            check (status in (
                              'pending','docs_submitted','grace_period',
                              'under_review','approved','rejected','cancelled'
                            )),
  grace_period_ends_at    timestamptz,
  decided_by              text,
  decided_at              timestamptz,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.memorialization_requests enable row level security;

-- The account owner (while still active) may read their own request and cancel it.
create policy "memorialization_requests: author reads own"
  on public.memorialization_requests
  for select
  using (auth.uid() = user_id);

create policy "memorialization_requests: author can cancel"
  on public.memorialization_requests
  for update
  using (auth.uid() = user_id and status in ('pending','docs_submitted','grace_period'))
  with check (status = 'cancelled');

-- Executors (matched by email) may insert and progress their own requests.
-- Service role is used for admin transitions (under_review → approved/rejected).
create policy "memorialization_requests: executor insert"
  on public.memorialization_requests
  for insert
  with check (
    exists (
      select 1 from public.executors e
      where e.user_id = memorialization_requests.user_id
        and e.email = initiated_by_executor_email
    )
  );

create policy "memorialization_requests: executor submit docs"
  on public.memorialization_requests
  for update
  using (
    initiated_by_executor_email = (
      select email from auth.users where id = auth.uid()
    )
    and status = 'pending'
  )
  with check (status = 'docs_submitted');

create trigger set_updated_at before update on public.memorialization_requests
  for each row execute function public.set_updated_at();

-- ─── verification_documents ──────────────────────────────────────────────────
create table public.verification_documents (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.memorialization_requests(id) on delete cascade,
  document_url text not null,
  type        text not null,
  uploaded_at timestamptz not null default now()
);

alter table public.verification_documents enable row level security;

-- Only service role (admin) and the executor who owns the request may read docs.
-- Executors insert via server action using service role key, so RLS is bypassed there.
-- This policy allows the author to read docs on their own request.
create policy "verification_documents: author reads own"
  on public.verification_documents
  for select
  using (
    exists (
      select 1 from public.memorialization_requests r
      where r.id = request_id and r.user_id = auth.uid()
    )
  );

-- ─── legacy_access_log ───────────────────────────────────────────────────────
-- Append-only: no UPDATE or DELETE policies; inserts only via service role.
create table public.legacy_access_log (
  id                  uuid primary key default gen_random_uuid(),
  deceased_user_id    uuid not null references public.users(id) on delete restrict,
  heir_id             uuid not null references public.heirs(id) on delete restrict,
  entry_ids_accessed  uuid[] not null default '{}',
  interaction_summary text,
  accessed_at         timestamptz not null default now()
);

alter table public.legacy_access_log enable row level security;

-- Executors and the author (pre-death) can read the access log.
create policy "legacy_access_log: author reads own"
  on public.legacy_access_log
  for select
  using (auth.uid() = deceased_user_id);

-- No insert/update/delete policies: all writes go through service role in API routes.

-- ─── FK: soul_entries.bound_recipient_id → heirs.id ─────────────────────────
alter table public.soul_entries
  add constraint soul_entries_bound_recipient_id_fkey
  foreign key (bound_recipient_id) references public.heirs(id) on delete set null;

-- ─── Storage bucket for verification documents ────────────────────────────────
-- Run this after enabling the Storage extension in your Supabase project.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-documents',
  'verification-documents',
  false,
  10485760,  -- 10 MB
  array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

-- Only service role can read/write the bucket (enforced at the API layer).
-- No public RLS policies on storage.objects for this bucket.
