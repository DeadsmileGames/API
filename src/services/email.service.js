import { Resend } from "resend";
import { env } from "../config/env.js";
import { sendTransactionalEmail } from "./brevo.service.js";
import { escapeHtml } from "../utils/html.js";
import { brandedEmail } from "./email-template.js";

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

export async function sendTicketNotification(ticket) {
  const { id, email: userEmail, category, message, created_at } = ticket;
  if (!resend || !env.notifyEmail) return;

  const safeId = escapeHtml(id);
  const safeEmail = escapeHtml(userEmail);
  const safeCategory = escapeHtml(category);
  const safeDate = escapeHtml(
    new Date(created_at).toLocaleString("en-US", {
      timeZone: "UTC",
      timeZoneName: "short",
    }),
  );
  const safeMessage = escapeHtml(message).replaceAll("\n", "<br>");

  try {
    const { error } = await resend.emails.send({
      from: "Deadsmile Games Support <onboarding@resend.dev>",
      to: env.notifyEmail,
      replyTo: userEmail,
      subject: `[Support Ticket #${id}] ${category}`,
      text: `New support ticket:\n\nID: ${id}\nUser: ${userEmail}\nCategory: ${category}\nDate: ${new Date(created_at).toISOString()}\n\nMessage:\n${message}\n\nTo reply, simply reply to this email – it will go directly to the user.`,
      html: brandedEmail({
        preheader: `New support request #${id}` ,
        heading: `Support request #${id}`,
        intro: "A player sent a message to Deadsmile Games Support.",
        bodyHtml: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 18px"><tr><td style="padding:8px 0;color:#b8b8b8;width:110px">From</td><td style="padding:8px 0;color:#f0f0f0;overflow-wrap:anywhere">${safeEmail}</td></tr><tr><td style="padding:8px 0;color:#b8b8b8">Category</td><td style="padding:8px 0;color:#f0f0f0">${safeCategory}</td></tr><tr><td style="padding:8px 0;color:#b8b8b8">Received</td><td style="padding:8px 0;color:#f0f0f0">${safeDate}</td></tr></table><div style="padding:16px;background:#0f0f0f;border:1px solid #3d3d3d;border-radius:8px;white-space:normal;overflow-wrap:anywhere">${safeMessage}</div><p style="margin:18px 0;color:#b8b8b8">Reply to this email to respond directly to the player.</p>`,
        footer: `Support ticket #${id} · Replies go to the player who submitted this request.`,
      }),
    });
    if (error) return;
  } catch {}
}

export async function sendPasswordResetEmail({ to, username, resetUrl }) {
  const displayName = username ? ` ${username}` : "";
  const safeName = username ? ` ${username}` : "";
  const safeResetUrl = resetUrl;
  const text = `Hi${displayName},\n\nWe received a request to reset your Deadsmile Games password.\n\nClick the link below to choose a new password (valid for 1 hour):\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.\n\n— Deadsmile Games`;
  const html = brandedEmail({
    preheader: "Secure link to reset your Deadsmile Games password.",
    heading: "Reset your password",
    intro: `Hi${safeName}, we received a request to reset your Deadsmile Games password.`,
    bodyHtml: '<p style="margin:0 0 16px;color:#b8b8b8;line-height:1.8">This secure link expires in 1 hour. If you did not request a reset, no action is needed and your password will remain unchanged.</p>',
    actionLabel: "Choose a new password",
    actionUrl: safeResetUrl,
    footer: "Password reset · Link expires in 1 hour.",
  });
  return sendTransactionalEmail({
    to,
    subject: "Reset your Deadsmile Games password",
    text,
    html,
  });
}
