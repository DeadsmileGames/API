CREATE TABLE IF NOT EXISTS user_legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  terms_version varchar(40) NOT NULL,
  privacy_version varchar(40) NOT NULL,
  locale varchar(10) NOT NULL CHECK (locale IN ('en', 'pt-BR', 'es')),
  accepted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_legal_acceptances_user_idx
  ON user_legal_acceptances (user_id, accepted_at DESC);
