-- 008_horizon.sql
-- Horizon: upcoming events, decisions, concerns, and goals
-- Users capture what's coming next; AI finds connections to their past.

CREATE TABLE IF NOT EXISTS horizon_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN ('event', 'decision', 'concern', 'goal')),
  title       text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text        CHECK (char_length(description) <= 2000),
  due_date    date,
  resolved    boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE horizon_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "horizon_owner_all"
  ON horizon_items FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for the dashboard query (unresolved items by due date)
CREATE INDEX IF NOT EXISTS horizon_items_user_unresolved
  ON horizon_items (user_id, resolved, due_date NULLS LAST);
