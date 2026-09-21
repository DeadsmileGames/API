ALTER TABLE games ADD COLUMN IF NOT EXISTS engine text NOT NULL DEFAULT 'native';
ALTER TABLE games ADD COLUMN IF NOT EXISTS save_path_template text;
ALTER TABLE games ADD COLUMN IF NOT EXISTS cloud_saves_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE games ADD COLUMN IF NOT EXISTS telemetry_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telemetry_consent boolean NOT NULL DEFAULT false;
ALTER TABLE news ADD COLUMN IF NOT EXISTS game_id uuid REFERENCES games(id) ON DELETE SET NULL;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS game_id uuid REFERENCES games(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS news_game_id_idx ON news (game_id, published_at DESC);
CREATE INDEX IF NOT EXISTS videos_game_id_idx ON videos (game_id, published_at DESC);

CREATE TABLE IF NOT EXISTS release_channels (
  id bigserial PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (name IN ('stable', 'beta', 'internal')),
  label text NOT NULL,
  public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, name)
);

CREATE TABLE IF NOT EXISTS game_builds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  channel_id bigint NOT NULL REFERENCES release_channels(id) ON DELETE CASCADE,
  version text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('windows', 'linux', 'macos')),
  architecture text NOT NULL DEFAULT 'x64',
  itch_channel text,
  download_url text,
  sha256 text CHECK (sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$'),
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, channel_id, version, platform, architecture)
);

CREATE INDEX IF NOT EXISTS game_builds_lookup_idx
ON game_builds (game_id, channel_id, platform, published_at DESC)
WHERE status = 'published';

CREATE TABLE IF NOT EXISTS beta_access (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  channel_id bigint NOT NULL REFERENCES release_channels(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  PRIMARY KEY (user_id, game_id, channel_id)
);

CREATE TABLE IF NOT EXISTS game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  launcher_version text,
  game_version text,
  platform text NOT NULL DEFAULT 'windows',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_ms bigint CHECK (duration_ms IS NULL OR duration_ms BETWEEN 0 AND 86400000)
);

CREATE INDEX IF NOT EXISTS game_sessions_user_idx ON game_sessions (user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS game_activity (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  total_ms bigint NOT NULL DEFAULT 0 CHECK (total_ms >= 0),
  sessions integer NOT NULL DEFAULT 0 CHECK (sessions >= 0),
  last_played_at timestamptz NOT NULL DEFAULT now(),
  public boolean NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS game_activity_public_idx ON game_activity (user_id, last_played_at DESC) WHERE public;

CREATE TABLE IF NOT EXISTS achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (key ~ '^[a-z0-9_]{2,80}$'),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon_url text,
  points integer NOT NULL DEFAULT 0 CHECK (points BETWEEN 0 AND 1000),
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, key)
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS cloud_saves (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  slot text NOT NULL CHECK (slot ~ '^[a-z0-9_-]{1,40}$'),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  payload text NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_id, slot)
);

CREATE TABLE IF NOT EXISTS telemetry_events (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  game_id uuid REFERENCES games(id) ON DELETE SET NULL,
  session_id uuid REFERENCES game_sessions(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('launcher_crash', 'game_crash', 'install_failed', 'update_failed')),
  app_version text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telemetry_events_created_idx ON telemetry_events (created_at DESC);

CREATE TABLE IF NOT EXISTS service_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  severity text NOT NULL CHECK (severity IN ('notice', 'degraded', 'outage')),
  status text NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating', 'monitoring', 'resolved')),
  started_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO release_channels (game_id, name, label, public)
SELECT id, 'stable', 'Stable', true FROM games
ON CONFLICT (game_id, name) DO NOTHING;

UPDATE games
SET engine = 'pico8',
    save_path_template = '{appdata}/pico-8/cdata/deadsmile_abbys_restless_heart.p8d.txt',
    cloud_saves_enabled = true
WHERE slug IN ('abbyrestlessheart', 'abbys-restless-heart');

INSERT INTO achievements (game_id, key, title, description, points)
SELECT id, 'finish_story', 'Restless no more', 'Reach the end of Abby’s journey.', 100
FROM games
WHERE slug IN ('abbyrestlessheart', 'abbys-restless-heart')
ON CONFLICT (game_id, key) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  points = EXCLUDED.points;

UPDATE news n
SET game_id = (
  SELECT g.id FROM games g
  WHERE lower(n.title) LIKE '%' || lower(g.title) || '%'
  ORDER BY length(g.title) DESC LIMIT 1
)
WHERE n.game_id IS NULL
  AND EXISTS (SELECT 1 FROM games g WHERE lower(n.title) LIKE '%' || lower(g.title) || '%');

UPDATE videos v
SET game_id = (
  SELECT g.id FROM games g
  WHERE lower(v.title) LIKE '%' || lower(g.title) || '%'
  ORDER BY length(g.title) DESC LIMIT 1
)
WHERE v.game_id IS NULL
  AND EXISTS (SELECT 1 FROM games g WHERE lower(v.title) LIKE '%' || lower(g.title) || '%');
