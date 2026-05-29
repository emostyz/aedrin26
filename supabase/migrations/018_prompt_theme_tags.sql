-- 018: Add theme_tag to daily_prompts for hard 30-day topic deduplication.
--
-- Instead of asking GPT to choose a topic (soft, easily repeated), the app now
-- picks from a 64-topic taxonomy deterministically, blocking any topic used in
-- the last 30 days. GPT only writes the question for the chosen topic.
--
-- theme_tag is the topic ID (e.g. 'family_mother', 'career_pivot'). Nullable
-- so existing rows aren't broken.

ALTER TABLE public.daily_prompts
  ADD COLUMN IF NOT EXISTS theme_tag TEXT;

COMMENT ON COLUMN public.daily_prompts.theme_tag IS
  'One of 64 predefined topic IDs (e.g. family_mother, career_pivot). '
  'Enforces that no topic is repeated within a 30-day window. '
  'Null on rows generated before this migration.';
