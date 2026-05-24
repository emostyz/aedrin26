-- Backfill public.users rows for any auth.users that lack one.
-- handle_new_user() (migration 001) creates this row on signup, but accounts
-- created before that trigger existed — or any signup where it failed — end up
-- with an auth identity but no profile row. That silently breaks every
-- FK-dependent write (soul_entries, life_events, value_summaries, …) and makes
-- profile UPDATEs no-op. This is idempotent and safe to re-run.
insert into public.users (id, email, legal_name)
select
  au.id,
  coalesce(au.email, ''),
  coalesce(au.raw_user_meta_data->>'legal_name', '')
from auth.users au
where not exists (
  select 1 from public.users pu where pu.id = au.id
);
