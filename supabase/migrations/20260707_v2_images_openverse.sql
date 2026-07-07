-- Attribution metadata for bank images sourced from Openverse (CC-licensed
-- photos). License is the Openverse slug (cc0, by, by-sa); attribution is the
-- ready-made credit string Openverse provides; source_url points back to the
-- original page on the provider (Flickr, Wikimedia, ...). Seed/Recraft images
-- predate these columns and leave them null.

ALTER TABLE v2_images
  ADD COLUMN license TEXT,
  ADD COLUMN attribution TEXT,
  ADD COLUMN source_url TEXT;
