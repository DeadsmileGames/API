ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS consent_given_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_text_version text,
  ADD COLUMN IF NOT EXISTS consent_locale text,
  ADD COLUMN IF NOT EXISTS consent_source text;
