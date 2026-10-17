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

export async function sendPasswordResetEmail({ to, username, resetUrl, locale = "en" }) {
  const language = ["en", "pt-BR", "es"].includes(locale) ? locale : "en";
  const displayName = username ? " " + username : "";
  const copy = {
    en: {
      subject: "Reset your Deadsmile Games password", preheader: "Secure link to reset your Deadsmile Games password.",
      heading: "Reset your password", intro: "Hi" + displayName + ", we received a request to reset your Deadsmile Games password.",
      expiry: "This secure link expires in 1 hour. If you did not request a reset, no action is needed and your password will remain unchanged.",
      action: "Choose a new password", footer: "Password reset · Link expires in 1 hour.",
      text: "Hi" + displayName + ",\n\nWe received a request to reset your Deadsmile Games password.\n\nClick the link below to choose a new password (valid for 1 hour):\n" + resetUrl + "\n\nIf you didn't request this, you can safely ignore this email.\n\n— Deadsmile Games",
    },
    "pt-BR": {
      subject: "Redefina sua senha da Deadsmile Games", preheader: "Link seguro para redefinir sua senha da Deadsmile Games.",
      heading: "Redefinir sua senha", intro: "Olá" + displayName + ", recebemos uma solicitação para redefinir a senha da sua conta Deadsmile Games.",
      expiry: "Este link seguro expira em 1 hora. Se você não solicitou a redefinição, não é necessário fazer nada e sua senha continuará a mesma.",
      action: "Escolher nova senha", footer: "Redefinição de senha · Link válido por 1 hora.",
      text: "Olá" + displayName + ",\n\nRecebemos uma solicitação para redefinir a senha da sua conta Deadsmile Games.\n\nUse o link abaixo para escolher uma nova senha (válido por 1 hora):\n" + resetUrl + "\n\nSe você não fez essa solicitação, pode ignorar este e-mail.\n\n— Deadsmile Games",
    },
    es: {
      subject: "Restablece tu contraseña de Deadsmile Games", preheader: "Enlace seguro para restablecer tu contraseña de Deadsmile Games.",
      heading: "Restablecer tu contraseña", intro: "Hola" + displayName + ", recibimos una solicitud para restablecer la contraseña de tu cuenta de Deadsmile Games.",
      expiry: "Este enlace seguro caduca en 1 hora. Si no solicitaste el cambio, no necesitas hacer nada y tu contraseña seguirá igual.",
      action: "Elegir una nueva contraseña", footer: "Restablecimiento de contraseña · Enlace válido durante 1 hora.",
      text: "Hola" + displayName + ",\n\nRecibimos una solicitud para restablecer la contraseña de tu cuenta de Deadsmile Games.\n\nUsa el siguiente enlace para elegir una nueva contraseña (válido durante 1 hora):\n" + resetUrl + "\n\nSi no realizaste esta solicitud, puedes ignorar este correo.\n\n— Deadsmile Games",
    },
  }[language];
  const html = brandedEmail({
    lang: language, preheader: copy.preheader, heading: copy.heading, intro: copy.intro,
    bodyHtml: '<p style="margin:0 0 16px;color:#b8b8b8;line-height:1.8">' + escapeHtml(copy.expiry) + "</p>",
    actionLabel: copy.action, actionUrl: resetUrl, footer: copy.footer,
  });
  return sendTransactionalEmail({ to, subject: copy.subject, text: copy.text, html });
}
