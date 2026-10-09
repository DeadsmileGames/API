CREATE TABLE news_translations (
  news_id uuid NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('pt-BR', 'es')),
  scope text NOT NULL CHECK (scope IN ('summary', 'detail')),
  source_hash text NOT NULL CHECK (source_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (news_id, locale, scope)
);
