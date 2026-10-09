ALTER TABLE games ADD COLUMN access_type text;
UPDATE games SET access_type = CASE WHEN NULLIF(BTRIM(purchase_url), '') IS NULL THEN 'free' ELSE 'paid' END;
ALTER TABLE games ALTER COLUMN access_type SET NOT NULL;
ALTER TABLE games ALTER COLUMN access_type SET DEFAULT 'free';
ALTER TABLE games ADD CONSTRAINT games_access_type_check CHECK (access_type IN ('free', 'paid'));
ALTER TABLE games ADD COLUMN itch_url text;
UPDATE games SET itch_url = regexp_replace(purchase_url, '/purchase/?$', '') WHERE purchase_url IS NOT NULL;
ALTER TABLE games ADD COLUMN microsoft_product_id text;
ALTER TABLE games ADD COLUMN microsoft_badge_image text;
ALTER TABLE games ADD CONSTRAINT games_microsoft_badge_check CHECK (
  (microsoft_product_id IS NULL AND microsoft_badge_image IS NULL) OR
  (microsoft_product_id IS NOT NULL AND microsoft_badge_image IS NOT NULL
    AND microsoft_product_id ~ '^[A-Z0-9]{12}$'
    AND microsoft_badge_image ~ '^https://get[.]microsoft[.]com/images/[a-z]{2}-[a-z]{2}%20(light|dark)[.]svg$')
);
ALTER TABLE user_game_entitlements DROP CONSTRAINT user_game_entitlements_source_check;
ALTER TABLE user_game_entitlements ADD CONSTRAINT user_game_entitlements_source_check CHECK (source IN ('itch', 'free'));
UPDATE user_game_entitlements e SET revoked_at = now()
FROM games g WHERE g.id = e.game_id AND g.access_type = 'paid' AND e.source = 'free';
CREATE OR REPLACE FUNCTION invalidate_free_entitlements() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.access_type <> NEW.access_type THEN
    UPDATE user_game_entitlements SET revoked_at = now(), last_verified_at = now() WHERE game_id = NEW.id;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER games_access_changed AFTER UPDATE OF access_type ON games
FOR EACH ROW EXECUTE FUNCTION invalidate_free_entitlements();
