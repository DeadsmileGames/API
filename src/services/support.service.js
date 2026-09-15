import { query } from '../config/database.js';
import { sendTicketNotification } from './email.service.js';

export async function createTicket({ email, category, message }) {
  const { rows } = await query(
    `INSERT INTO support_tickets (email, category, message)
     VALUES ($1, $2, $3)
     RETURNING id, email, category, message, status, created_at`,
    [email.toLowerCase(), category, message],
  );
  const ticket = rows[0];
  sendTicketNotification(ticket).catch(() => {});
  return ticket;
}
