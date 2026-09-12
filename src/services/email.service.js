import { Resend } from 'resend';
import { env } from '../config/env.js';
import { sendTransactionalEmail } from './brevo.service.js';
const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

export async function sendTicketNotification(ticket) {
  const { id, email: userEmail, category, message, created_at } = ticket;

  if (!resend) {
    return;
  }

  if (!env.notifyEmail) {
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'DEADSMILE Support <onboarding@resend.dev>',
      to: env.notifyEmail,
      replyTo: userEmail,
      subject: `[Support Ticket #${id}] ${category}`,
      text: `
New support ticket:

ID: ${id}
User: ${userEmail}
Category: ${category}
Date: ${new Date(created_at).toLocaleString()}

Message:
${message}

To reply, simply reply to this email – it will go directly to the user.
      `,
      html: `
<h2>New support ticket</h2>
<p><strong>ID:</strong> ${id}</p>
<p><strong>User:</strong> ${userEmail}</p>
<p><strong>Category:</strong> ${category}</p>
<p><strong>Date:</strong> ${new Date(created_at).toLocaleString()}</p>
<h3>Message:</h3>
<p>${message.replace(/\n/g, '<br>')}</p>
<p><em>To reply, simply reply to this email – it will go directly to the user.</em></p>
      `,
    });

    if (error) return;
  } catch {}
}
export async function sendPasswordResetEmail({
  to,
  username,
  resetUrl,
}) {
  const safeName = username
    ? ` ${username}`
    : '';

  const text = `
Hi${safeName},

We received a request to reset your DEADSMILE password.

Click the link below to choose a new password (valid for 1 hour):
${resetUrl}

If you didn't request this, you can safely ignore this email.

— DEADSMILE Games
  `.trim();

  const html = `
<div style="font-family:system-ui,sans-serif;background:#0b0b0b;color:#eaeaea;padding:40px;border-radius:12px;max-width:520px;margin:auto;">
  <h2 style="margin:0 0 16px;font-size:20px;">
    Reset your password
  </h2>

  <p style="color:#aaa;line-height:1.6;margin:0 0 24px;">
    Hi${safeName}, we received a request to reset your DEADSMILE password.
  </p>

  <a
    href="${resetUrl}"
    style="display:inline-block;background:#fff;color:#0b0b0b;padding:12px 22px;border-radius:999px;font-weight:700;text-decoration:none;"
  >
    Choose a new password
  </a>

  <p style="color:#666;font-size:12px;line-height:1.6;margin:24px 0 0;">
    This link expires in 1 hour. If you didn't request this, ignore this email.
  </p>
</div>
  `.trim();

  return sendTransactionalEmail({
    to,
    subject: 'Reset your DEADSMILE password',
    text,
    html,
  });
}