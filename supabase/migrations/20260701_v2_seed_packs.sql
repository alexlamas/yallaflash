-- Seed data for V2: one language row + one small starter pack, so the
-- "browse packs" onboarding branch has something to show. Etymology fields
-- are intentionally left null here -- the tutor generates/flags those live,
-- rather than baking in unverified claims as seed data.

INSERT INTO v2_languages (code, name, script_direction, has_transliteration)
VALUES ('leb-ar', 'Lebanese Arabic', 'rtl', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO v2_packs (language_id, name, description)
SELECT id, 'Everyday basics', 'Common greetings and phrases you''ll hear constantly in Lebanon'
FROM v2_languages l
WHERE l.code = 'leb-ar'
AND NOT EXISTS (
  SELECT 1 FROM v2_packs p WHERE p.language_id = l.id AND p.name = 'Everyday basics'
);

INSERT INTO v2_words (language_id, pack_id, arabizi, script, english, type, memory_hook)
SELECT l.id, p.id, w.arabizi, w.script, w.english, w.type, w.memory_hook
FROM v2_languages l
JOIN v2_packs p ON p.language_id = l.id AND p.name = 'Everyday basics'
CROSS JOIN (VALUES
  ('marhaba', 'مرحبا', 'hello', 'phrase', 'Universal greeting, works with anyone anytime'),
  ('shukran', 'شكرا', 'thank you', 'phrase', 'Same word MSA speakers use too'),
  ('yalla', 'يلا', 'let''s go / come on', 'phrase', 'Said constantly to hurry someone up or wrap up a conversation'),
  ('kifak', 'كيفك', 'how are you (to a man)', 'phrase', 'Add -ik for a woman: kifik'),
  ('mni7', 'منيح', 'good / fine', 'adjective', 'Standard answer to kifak'),
  ('la', 'لا', 'no', 'particle', 'Short and blunt -- often doubled: la la'),
  ('ktir', 'كتير', 'a lot / very', 'adverb', 'Put it after an adjective to mean "very": mni7 ktir = very good'),
  ('habibi', 'حبيبي', 'my dear (to a man)', 'noun', 'Used constantly as a term of address, not just romantically')
) AS w(arabizi, script, english, type, memory_hook)
WHERE l.code = 'leb-ar'
AND NOT EXISTS (
  SELECT 1 FROM v2_words existing
  WHERE existing.pack_id = p.id AND existing.arabizi = w.arabizi
);
