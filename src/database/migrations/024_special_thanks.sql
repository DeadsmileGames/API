CREATE TABLE IF NOT EXISTS special_thanks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS special_thanks_name_lower_uq
  ON special_thanks (lower(btrim(name)));

CREATE INDEX IF NOT EXISTS special_thanks_created_at_idx
  ON special_thanks (created_at, id);
