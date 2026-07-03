-- Per-user running notes on a word, editable by the tutor mid-conversation.
-- Lives on v2_word_progress (not v2_words) so it works for shared pack words
-- too -- the note is the user's relationship with the word, not a fact about
-- the word itself. v2_words.notes remains for word-level notes captured at
-- add time.

ALTER TABLE v2_word_progress ADD COLUMN IF NOT EXISTS notes TEXT;
