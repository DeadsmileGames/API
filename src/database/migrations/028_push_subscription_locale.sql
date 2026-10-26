ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en'
  CHECK (locale IN ('en', 'pt-BR', 'es'));
