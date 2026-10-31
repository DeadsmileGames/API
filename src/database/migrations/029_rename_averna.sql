UPDATE games
SET title = 'Averna'
WHERE slug IN ('abbyrestlessheart', 'abbys-restless-heart', 'abby-s-restless-heart');

UPDATE achievements a
SET description = CASE a.key
  WHEN 'finish_story' THEN 'Reach the end of Averna''s journey.'
  WHEN 'no_death_finish' THEN 'Finish Averna''s journey without dying.'
  ELSE a.description
END
FROM games g
WHERE a.game_id = g.id
  AND g.slug IN ('abbyrestlessheart', 'abbys-restless-heart', 'abby-s-restless-heart')
  AND a.key IN ('finish_story', 'no_death_finish');
