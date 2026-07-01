-- Language-agnostic image bank. Images are keyed by concept (a lowercase
-- English term), not by language, so the same picture of "water" serves any
-- future language. Seeded from the existing V1 pack illustrations; new images
-- will later be added via a generation endpoint (Recraft) when the bank has
-- no match.

CREATE TABLE v2_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'seed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE v2_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read images"
  ON v2_images FOR SELECT
  USING (true);

-- Seed from the existing pack illustrations (hand-drawn Recraft images).
INSERT INTO v2_images (concept, url, source)
SELECT lower(name), image_url, 'v1_pack'
FROM packs
WHERE image_url IS NOT NULL
ON CONFLICT (concept) DO NOTHING;
