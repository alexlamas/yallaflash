-- Users can stop learning a word (removes their progress row; the word
-- itself stays in the reservoir / their custom list).
-- Applied to prod 2026-07-03 via Supabase MCP.

DROP POLICY IF EXISTS "Users can delete own progress" ON v2_word_progress;
CREATE POLICY "Users can delete own progress"
  ON v2_word_progress FOR DELETE
  USING (auth.uid() = user_id);
