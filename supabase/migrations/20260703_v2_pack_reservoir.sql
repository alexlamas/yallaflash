-- Import the V1 pack catalog into V2 as the learning reservoir: pack words
-- the tutor and the zero-due "learn something new" picker can draw from.
-- Words are NOT added to anyone's queue here -- starting a word is a
-- per-user choice that creates its v2_word_progress row.
-- Idempotent: safe to re-run.

INSERT INTO v2_packs (language_id, name, description)
SELECT
  (SELECT id FROM v2_languages WHERE code = 'leb-ar'),
  p.name,
  p.description
FROM packs p
WHERE NOT EXISTS (SELECT 1 FROM v2_packs vp WHERE vp.name = p.name);

INSERT INTO v2_words (language_id, arabizi, script, english, type, pack_id)
SELECT
  (SELECT id FROM v2_languages WHERE code = 'leb-ar'),
  w.transliteration,
  w.arabic,
  w.english,
  w.type,
  (SELECT vp.id FROM v2_packs vp
     WHERE vp.name = (SELECT p.name FROM packs p WHERE p.id = w.pack_id))
FROM words w
WHERE w.pack_id IS NOT NULL
  AND w.user_id IS NULL
  AND COALESCE(w.transliteration, '') <> ''
  AND COALESCE(w.english, '') <> ''
  AND NOT EXISTS (
    SELECT 1 FROM v2_words v
    WHERE v.arabizi = w.transliteration AND v.english = w.english
  );
