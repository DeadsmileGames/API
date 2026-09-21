import { Resend } from 'resend';
import { env } from '../config/env.js';
import { sendTransactionalEmail } from './brevo.service.js';
import { escapeHtml } from '../utils/html.js';

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

export async function sendTicketNotification(ticket) {
  const { id, email: userEmail, category, message, created_at } = ticket;
  if (!resend || !env.notifyEmail) return;

  const safeId = escapeHtml(id);
  const safeEmail = escapeHtml(userEmail);
  const safeCategory = escapeHtml(category);
  const safeDate = escapeHtml(new Date(created_at).toLocaleString('en-US', { timeZone: 'UTC', timeZoneName: 'short' }));
  const safeMessage = escapeHtml(message).replaceAll('\n', '<br>');

  try {
    const { error } = await resend.emails.send({
      from: 'Deadsmile Games Support <onboarding@resend.dev>',
      to: env.notifyEmail,
      replyTo: userEmail,
      subject: `[Support Ticket #${id}] ${category}`,
      text: `New support ticket:\n\nID: ${id}\nUser: ${userEmail}\nCategory: ${category}\nDate: ${new Date(created_at).toISOString()}\n\nMessage:\n${message}\n\nTo reply, simply reply to this email – it will go directly to the user.`,
      html: `<h2>New support ticket</h2><p><strong>ID:</strong> ${safeId}</p><p><strong>User:</strong> ${safeEmail}</p><p><strong>Category:</strong> ${safeCategory}</p><p><strong>Date:</strong> ${safeDate}</p><h3>Message:</h3><p>${safeMessage}</p><p><em>To reply, simply reply to this email – it will go directly to the user.</em></p>`,
    });
    if (error) return;
  } catch {}
}

export async function sendPasswordResetEmail({ to, username, resetUrl }) {
  const displayName = username ? ` ${username}` : '';
  const safeName = username ? ` ${escapeHtml(username)}` : '';
  const safeResetUrl = escapeHtml(resetUrl);
  const text = `Hi${displayName},\n\nWe received a request to reset your Deadsmile Games password.\n\nClick the link below to choose a new password (valid for 1 hour):\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.\n\n— Deadsmile Games`;
  const html = `<div style="font-family:system-ui,sans-serif;background:#0b0b0b;color:#eaeaea;padding:40px;border-radius:12px;max-width:520px;margin:auto;"><h2 style="margin:0 0 16px;font-size:20px;">Reset your password</h2><p style="color:#aaa;line-height:1.6;margin:0 0 24px;">Hi${safeName}, we received a request to reset your Deadsmile Games password.</p><a href="${safeResetUrl}" style="display:inline-block;background:#fff;color:#0b0b0b;padding:12px 22px;border-radius:999px;font-weight:700;text-decoration:none;">Choose a new password</a><p style="color:#666;font-size:12px;line-height:1.6;margin:24px 0 0;">This link expires in 1 hour. If you didn't request this, ignore this email.</p></div>`;
  return sendTransactionalEmail({
    to,
    subject: 'Reset your Deadsmile Games password',
    text,
    html,
  });
}
