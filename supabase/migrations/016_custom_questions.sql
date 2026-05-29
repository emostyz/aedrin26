-- Custom interview questions added by users.
-- These appear alongside the system prompts in their chosen domain.

create table if not exists custom_questions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  domain      text not null,
  text        text not null check (char_length(text) between 5 and 500),
  ord         int not null default 0,
  created_at  timestamptz not null default now()
);

alter table custom_questions enable row level security;

create policy "Users manage own custom questions"
  on custom_questions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index on custom_questions (user_id, domain);
