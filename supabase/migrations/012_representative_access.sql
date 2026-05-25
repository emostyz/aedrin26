-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 012 — Authorized Representative Verification & Scoped Access
--
-- Adds a self-service portal where a person proves they are an authorized
-- representative of a deceased (legacy_active) user and receives scoped,
-- time-bound, revocable, audited access. Death itself is still verified by the
-- existing memorialization flow; this governs *who may access*, separately.
--
-- No formal legal instruments are required in this phase (identity/relationship
-- evidence only). Low-risk, author-pre-designated requests auto-approve; all
-- others escalate to a human. Risk is scored by an NLP screen in the app layer.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── access_requests ──────────────────────────────────────────────────────────
create table public.access_requests (
  id                        uuid primary key default gen_random_uuid(),
  deceased_user_id          uuid not null references public.users(id) on delete cascade,
  requester_user_id         uuid not null references public.users(id) on delete cascade,
  requester_email           text not null,
  claimed_role              text not null
                              check (claimed_role in ('heir','executor','legal_representative','next_of_kin','other')),
  relationship              text not null,
  message                   text,
  status                    text not null default 'submitted'
                              check (status in ('submitted','docs_submitted','pending_review','approved','rejected','cancelled','expired')),
  attestation_accepted_at   timestamptz,
  risk_level                text check (risk_level in ('low','elevated','high')),
  risk_reasons              text,
  auto_approved             boolean not null default false,
  decided_by                text,   -- 'auto' | 'admin'
  decided_at                timestamptz,
  review_notes              text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

alter table public.access_requests enable row level security;

-- Requester sees their own requests.
create policy "access_requests: requester reads own"
  on public.access_requests
  for select
  using (auth.uid() = requester_user_id);

-- The subject (pre-death) can see requests filed against their account.
create policy "access_requests: subject reads own"
  on public.access_requests
  for select
  using (auth.uid() = deceased_user_id);

-- Requester files their own request.
create policy "access_requests: requester inserts own"
  on public.access_requests
  for insert
  with check (auth.uid() = requester_user_id);

-- Requester may cancel while still pending (terminal/decision transitions are
-- performed by the service role in the app layer).
create policy "access_requests: requester cancels own"
  on public.access_requests
  for update
  using (auth.uid() = requester_user_id and status in ('submitted','docs_submitted','pending_review'))
  with check (status = 'cancelled');

create index access_requests_requester_idx on public.access_requests (requester_user_id);
create index access_requests_deceased_idx  on public.access_requests (deceased_user_id);
create index access_requests_status_idx    on public.access_requests (status);

create trigger set_updated_at before update on public.access_requests
  for each row execute function public.set_updated_at();

-- ── access_request_documents ─────────────────────────────────────────────────
-- Identity / relationship evidence only (no legal instruments this phase).
create table public.access_request_documents (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.access_requests(id) on delete cascade,
  document_url text not null,
  type        text not null check (type in ('government_id','relationship_proof','other')),
  uploaded_at timestamptz not null default now()
);

alter table public.access_request_documents enable row level security;

-- Requester can read docs on their own request. All writes go through the
-- service role in the upload route (no insert/update/delete policies).
create policy "access_request_documents: requester reads own"
  on public.access_request_documents
  for select
  using (exists (
    select 1 from public.access_requests r
    where r.id = request_id and r.requester_user_id = auth.uid()
  ));

create index access_request_documents_request_idx on public.access_request_documents (request_id);

-- ── heirs: additive security-protocol columns (non-breaking) ──────────────────
alter table public.heirs add column if not exists verified_at              timestamptz;
alter table public.heirs add column if not exists verification_request_id  uuid references public.access_requests(id) on delete set null;
alter table public.heirs add column if not exists access_expires_at        timestamptz;
alter table public.heirs add column if not exists can_negotiate            boolean not null default false;

-- ── Storage bucket for representative identity/relationship documents ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'representative-documents',
  'representative-documents',
  false,
  10485760,  -- 10 MB
  array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

-- Only the service role reads/writes this bucket (enforced at the API layer).
-- No public RLS policies on storage.objects for this bucket.
