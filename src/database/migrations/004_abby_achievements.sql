UPDATE games
SET engine = 'pico8',
    save_path_template = '{appdata}/pico-8/cdata/deadsmile_abbys_restless_heart.p8d.txt',
    cloud_saves_enabled = true
WHERE slug IN ('abbyrestlessheart', 'abbys-restless-heart');

INSERT INTO achievements (game_id, key, title, description, points, hidden)
SELECT g.id, v.key, v.title, v.description, v.points, v.hidden
FROM games g
CROSS JOIN (VALUES
  ('finish_story', 'Restless no more', 'Reach the end of Abby''s journey.', 100, false),
  ('first_checkpoint', 'Keep moving', 'Reach your first checkpoint.', 20, false),
  ('first_coin', 'A little spark', 'Collect your first coin.', 20, false),
  ('all_coins', 'Every little piece', 'Collect every coin in a run.', 75, false),
  ('no_death_finish', 'Unbroken Heart', 'Finish Abby''s journey without dying.', 150, true)
) AS v(key, title, description, points, hidden)
WHERE g.slug IN ('abbyrestlessheart', 'abbys-restless-heart')
ON CONFLICT (game_id, key) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  points = EXCLUDED.points,
  hidden = EXCLUDED.hidden;
