import { query } from '../config/database.js';
import { AppError } from '../utils/AppError.js';

export async function subscribe(email) {
  const { rows } = await query(
    `INSERT INTO newsletter_subscribers (email)
     VALUES ($1)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, email, created_at`,
    [email.toLowerCase()]
  );

  if (!rows[0]) throw new AppError(409, 'ALREADY_SUBSCRIBED', 'This email is already subscribed.');
  return rows[0];
}
