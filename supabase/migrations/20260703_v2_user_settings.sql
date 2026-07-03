-- Per-user tutor settings: the editable slice of the tutor's behavior.
-- Applied to prod 2026-07-03 via Supabase MCP.

CREATE TABLE IF NOT EXISTS v2_user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tutor_instructions TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE v2_user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own settings" ON v2_user_settings;
CREATE POLICY "Users manage own settings"
  ON v2_user_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
