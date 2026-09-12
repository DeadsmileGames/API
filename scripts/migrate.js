import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/config/database.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const directory = path.join(root, '..', 'src', 'database', 'migrations');

try {
  const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  for (const file of files) {
    await pool.query(await readFile(path.join(directory, file), 'utf8'));
  }
} finally {
  await pool.end();
}
