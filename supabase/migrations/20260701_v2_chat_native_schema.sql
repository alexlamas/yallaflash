-- V2 chat-native schema.
-- Additive: lives alongside the existing words/sentences/word_progress tables
-- (prefixed v2_) so the current app keeps working while V2 is built out.
-- Run manually in the Supabase SQL editor, same as other files in this folder.

CREATE TABLE v2_languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  script_direction TEXT NOT NULL DEFAULT 'ltr' CHECK (script_direction IN ('ltr', 'rtl')),
  has_transliteration BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE v2_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_id UUID NOT NULL REFERENCES v2_languages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE v2_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_id UUID NOT NULL REFERENCES v2_languages(id) ON DELETE CASCADE,
  arabizi TEXT NOT NULL,
  script TEXT,
  english TEXT NOT NULL,
  type TEXT,
  memory_hook TEXT,
  etymology_note TEXT,
  etymology_confidence TEXT CHECK (etymology_confidence IN ('confident', 'uncertain')),
  notes TEXT,
  pack_id UUID REFERENCES v2_packs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX v2_words_pack_id_idx ON v2_words(pack_id);
CREATE INDEX v2_words_user_id_idx ON v2_words(user_id);

CREATE TABLE v2_word_progress (
  word_id UUID NOT NULL REFERENCES v2_words(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'learning', 'learned')),
  interval DOUBLE PRECISION NOT NULL DEFAULT 0,
  ease_factor DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  review_count INTEGER NOT NULL DEFAULT 0,
  next_review_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, word_id)
);

CREATE INDEX v2_word_progress_due_idx ON v2_word_progress(user_id, next_review_date);

CREATE TABLE v2_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE v2_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES v2_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL DEFAULT '',
  widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX v2_messages_conversation_id_idx ON v2_messages(conversation_id, created_at);

-- RLS

ALTER TABLE v2_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_word_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read languages"
  ON v2_languages FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read packs"
  ON v2_packs FOR SELECT
  USING (true);

CREATE POLICY "Pack words and own words are readable"
  ON v2_words FOR SELECT
  USING (pack_id IS NOT NULL OR user_id = auth.uid());

CREATE POLICY "Users can add their own custom words"
  ON v2_words FOR INSERT
  WITH CHECK (user_id = auth.uid() AND pack_id IS NULL);

CREATE POLICY "Users can edit their own custom words"
  ON v2_words FOR UPDATE
  USING (user_id = auth.uid() AND pack_id IS NULL);

CREATE POLICY "Users can delete their own custom words"
  ON v2_words FOR DELETE
  USING (user_id = auth.uid() AND pack_id IS NULL);

CREATE POLICY "Users can read own progress"
  ON v2_word_progress FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own progress"
  ON v2_word_progress FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own progress"
  ON v2_word_progress FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can read own conversations"
  ON v2_conversations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own conversations"
  ON v2_conversations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own conversations"
  ON v2_conversations FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can read messages in own conversations"
  ON v2_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM v2_conversations c
    WHERE c.id = v2_messages.conversation_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can add messages to own conversations"
  ON v2_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM v2_conversations c
    WHERE c.id = v2_messages.conversation_id AND c.user_id = auth.uid()
  ));
