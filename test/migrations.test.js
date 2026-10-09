import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

test('existing database migrates without changing historical checksums or losing games and saves', async () => {
  const db = await PGlite.create({ extensions: { pg_trgm } });
  const schema = await readFile(new URL('../src/database/schema.sql', import.meta.url), 'utf8');
  await db.exec(schema.split('ALTER TABLE games ADD COLUMN access_type text;')[0]);
  await db.exec("ALTER TABLE content_events DROP CONSTRAINT content_events_event_type_check; ALTER TABLE content_events ADD CONSTRAINT content_events_event_type_check CHECK (event_type IN ('news.published','game.published','video.published','wishlist.updated'));");
  const files = (await readdir(new URL('../src/database/migrations/', import.meta.url))).filter(name => name.endsWith('.sql') && name < '008_').sort();
  for (const name of files) {
    const sql = await readFile(new URL(`../src/database/migrations/${name}`, import.meta.url), 'utf8');
    await db.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [name, crypto.createHash('sha256').update(sql).digest('hex')]);
  }
  await db.exec(`INSERT INTO users (id,email,username,password_hash) VALUES ('00000000-0000-4000-8000-000000000001','test@example.test','tester','hash');
    INSERT INTO games (id,title,slug,short_description,status,purchase_url) VALUES
    ('00000000-0000-4000-8000-000000000002','Free','free','free','released',null),
    ('00000000-0000-4000-8000-000000000003','Paid','paid','paid','released','https://studio.itch.io/paid/purchase');
    INSERT INTO cloud_saves (user_id,game_id,slot,payload,sha256) VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','default','original-save','${'0'.repeat(64)}');`);
  const socket = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1' });
  await socket.start();
  process.env.DATABASE_URL = `postgres://postgres:postgres@${socket.getServerConn()}/postgres`;
  process.env.SESSION_SECRET = 'isolated-migration-session-secret'.repeat(2);
  process.env.DATA_ENCRYPTION_KEY = 'isolated-migration-data-secret'.repeat(2);
  try {
    await import('../scripts/migrate.js');
    const games = await db.query('SELECT slug,access_type FROM games ORDER BY slug');
    assert.deepEqual(games.rows, [{ slug: 'free', access_type: 'free' }, { slug: 'paid', access_type: 'paid' }]);
    const saved = (await db.query('SELECT payload,revision FROM cloud_saves')).rows[0];
    assert.match(saved.payload, /^enc\.v2\./);
    const { decryptSecret } = await import('../src/utils/secretCipher.js');
    assert.equal(decryptSecret(saved.payload, 'save:00000000-0000-4000-8000-000000000001:00000000-0000-4000-8000-000000000002:default'), 'original-save');
    assert.equal((await db.query('SELECT count(*) AS count FROM schema_migrations')).rows[0].count, 13);
    await db.query("UPDATE games SET download_url='https://downloads.example.test/' || repeat('x', 300) || '.zip' WHERE slug='free'");
    assert((await db.query("SELECT length(download_url) AS size FROM games WHERE slug='free'")).rows[0].size > 255);
    await db.query("INSERT INTO content_events(event_type,entity_id) VALUES('game.updated','test'),('news.deleted','test'),('video.updated','test')");
    await assert.rejects(db.query("INSERT INTO content_events(event_type,entity_id) VALUES('unrecognized.event','test')"));
    assert.equal((await db.query("SELECT to_regclass('public.news_translations') AS name")).rows[0].name, null);
  } finally { await socket.stop(); await db.close(); }
});

test('removing the translation cache preserves original newswire posts', async () => {
 const db = await PGlite.create({ extensions: { pg_trgm } });
 try {
  await db.exec(await readFile(new URL('../src/database/schema.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../src/database/migrations/011_news_translations.sql', import.meta.url), 'utf8'));
  const post = (await db.query("INSERT INTO news(title,slug,category,body) VALUES('Original','original-news','Devlog','<p>Original body</p>') RETURNING id")).rows[0];
  await db.query("INSERT INTO news_translations(news_id,locale,scope,source_hash,payload,expires_at) VALUES($1,'pt-BR','detail',$2,'{}',now())", [post.id, 'a'.repeat(64)]);
  await db.exec(await readFile(new URL('../src/database/migrations/012_remove_news_translations.sql', import.meta.url), 'utf8'));
  assert.deepEqual((await db.query('SELECT title,body FROM news WHERE id=$1', [post.id])).rows, [{ title: 'Original', body: '<p>Original body</p>' }]);
  assert.equal((await db.query("SELECT to_regclass('public.news_translations') AS name")).rows[0].name, null);
 } finally { await db.close(); }
});
