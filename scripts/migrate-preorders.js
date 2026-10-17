import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { directPool } from "../src/config/database.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const migrationName = "017_preorders.sql";
const migrationPath = path.join(root, "..", "src", "database", "migrations", migrationName);
const sql = await readFile(migrationPath, "utf8");
const checksum = crypto.createHash("sha256").update(sql).digest("hex");
const client = await directPool.connect();
let locked = false;

try {
  await client.query("SELECT pg_advisory_lock(hashtext($1))", ["deadsmile_preorders_migration_v1"]);
  locked = true;
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamp with time zone NOT NULL DEFAULT now()
  )`);
  const existing = await client.query("SELECT checksum FROM schema_migrations WHERE name = $1", [migrationName]);
  if (existing.rows[0]) {
    if (existing.rows[0].checksum !== checksum) throw new Error("Preorder migration checksum mismatch.");
    const columns = await client.query(
      "SELECT count(*)::int AS count FROM information_schema.columns WHERE table_schema='public' AND table_name='games' AND column_name = ANY($1::text[])",
      [["preorder_enabled", "preorder_starts_at", "preorder_ends_at", "preorder_age_ratings", "preorder_reward_type", "preorder_reward_description", "preorder_reward_zip", "preorder_reward_wallpapers"]],
    );
    if (columns.rows[0]?.count === 8) process.exitCode = 0;
    else throw new Error("Preorder migration is recorded but its schema is incomplete.");
  } else {
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(name, checksum) VALUES($1, $2)", [migrationName, checksum]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  if (locked) {
    try {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", ["deadsmile_preorders_migration_v1"]);
    } catch {}
  }
  client.release();
  await directPool.end();
}
