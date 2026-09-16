import 'dotenv/config';
import { hashPassword } from '../src/utils/password.js';
import { upsertAdminUser } from '../src/repositories/users.repository.js';
import { pool } from '../src/config/database.js';

async function main() {
  const email    = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const username = process.env.ADMIN_USERNAME || 'admin';

  if (!email || !password) {
    process.exitCode = 1;
    return;
  }

  if (password.length < 12) {
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(password);
  await upsertAdminUser({ username, email, passwordHash });
}

main()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(() => pool.end());
