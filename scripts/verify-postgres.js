import crypto from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { directPool } from "../src/config/database.js";

const directory = new URL("../src/database/migrations/", import.meta.url);
const migrationFiles = (await readdir(directory))
  .filter((name) => name.endsWith(".sql"))
  .sort();

const client = await directPool.connect();
try {
  const { rows } = await client.query(
    "SELECT name, checksum FROM schema_migrations ORDER BY name",
  );
  const recorded = new Map(rows.map(({ name, checksum }) => [name, checksum]));

  if (recorded.size !== migrationFiles.length) {
    throw new Error(
      `Expected ${migrationFiles.length} registered migrations, found ${recorded.size}.`,
    );
  }

  for (const name of migrationFiles) {
    const contents = await readFile(new URL(name, directory));
    const expected = crypto.createHash("sha256").update(contents).digest("hex");
    if (recorded.get(name) !== expected) {
      throw new Error(`Missing migration or checksum mismatch: ${name}`);
    }
  }

  const { rows: schemaRows } = await client.query(
    "SELECT to_regclass('public.games') IS NOT NULL AS games, to_regclass('public.cloud_saves') IS NOT NULL AS cloud_saves",
  );
  if (!schemaRows[0]?.games || !schemaRows[0]?.cloud_saves) {
    throw new Error("The database is missing a required core table.");
  }

  console.log(`PASS: ${migrationFiles.length} migration checksums and core tables verified.`);
} finally {
  client.release();
  await directPool.end();
}
