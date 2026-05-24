-- 010: Work and family profile fields
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS company           text,
  ADD COLUMN IF NOT EXISTS job_title         text,
  ADD COLUMN IF NOT EXISTS job_happiness     text,
  ADD COLUMN IF NOT EXISTS career_goals      text,
  ADD COLUMN IF NOT EXISTS family_description text;
