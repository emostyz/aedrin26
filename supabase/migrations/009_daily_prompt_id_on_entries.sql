-- soul_entries.prompt_id references interview_prompts(id), which is for static
-- interview flow prompts. Daily prompts are a separate table (daily_prompts) with
-- AI-generated, user-personalised questions. Add a dedicated FK column so entries
-- answered from the dashboard "Today's reflection" card are linked correctly.

ALTER TABLE soul_entries
  ADD COLUMN IF NOT EXISTS daily_prompt_id uuid
    REFERENCES daily_prompts(id) ON DELETE SET NULL;

COMMENT ON COLUMN soul_entries.daily_prompt_id IS
  'Set when this entry was written in response to a daily AI-generated prompt. '
  'Mutually exclusive with prompt_id (which links to static interview_prompts).';
