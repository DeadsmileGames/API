ALTER TABLE games ADD COLUMN IF NOT EXISTS itch_game_id bigint;

UPDATE games
SET purchase_url = 'https://deadsml.itch.io/abbyrestlessheart/purchase',
    itch_game_id = 4520313
WHERE id = (
  SELECT id
  FROM games
  WHERE itch_game_id IS NULL
    AND (
      slug IN ('abbyrestlessheart', 'abbys-restless-heart')
      OR purchase_url IN (
        'https://deadsml.itch.io/abbyrestlessheart',
        'https://deadsml.itch.io/abbyrestlessheart/purchase'
      )
    )
  ORDER BY (purchase_url IS NOT NULL) DESC, created_at ASC
  LIMIT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS games_itch_game_id_unique
ON games (itch_game_id)
WHERE itch_game_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_itch_accounts (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  itch_user_id bigint NOT NULL UNIQUE,
  itch_username text NOT NULL,
  itch_profile_url text,
  access_token_encrypted text NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz NOT NULL DEFAULT now(),
  last_sync_at timestamptz
);

CREATE TABLE IF NOT EXISTS itch_oauth_states (
  state_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client text NOT NULL CHECK (client IN ('site', 'launcher')),
  locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'pt-BR', 'es')),
  return_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS itch_oauth_states_user_id_idx
ON itch_oauth_states (user_id);

CREATE TABLE IF NOT EXISTS user_game_entitlements (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'itch' CHECK (source = 'itch'),
  external_reference text,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS user_game_entitlements_active_idx
ON user_game_entitlements (user_id, revoked_at);
