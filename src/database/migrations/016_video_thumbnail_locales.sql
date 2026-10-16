ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS thumbnail_en text,
  ADD COLUMN IF NOT EXISTS thumbnail_pt_br text,
  ADD COLUMN IF NOT EXISTS thumbnail_es text;
