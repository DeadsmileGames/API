import crypto from "node:crypto";

import { AppError } from "../utils/AppError.js";
import { env } from "../config/env.js";
import { query } from "../config/database.js";
import { verifyPassword } from "../utils/password.js";

import { findUserByEmail, findUserById } from "../repositories/users.repository.js";

import {
  createPendingEmailToken,
  deleteUnsentToken,
  confirmEmailToken,
} from "../repositories/account-email.repository.js";

import { sendTransactionalEmail } from "./brevo.service.js";
import { escapeHtml } from "../utils/html.js";
import { brandedEmail } from "./email-template.js";

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
async function deliverConfirmation({ userId, purpose, email, locale = "en" }) {
  const language = ["en", "pt-BR", "es"].includes(locale) ? locale : "en";
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(token);
  const saved = await createPendingEmailToken({
    userId, purpose, email, hash: tokenHash,
    expiresAt: new Date(Date.now() + 30 * 60_000),
  });
  if (!saved) throw new AppError(429, "EMAIL_CONFIRMATION_COOLDOWN");

  const url = env.frontendUrl + "/verify-email?token=" + encodeURIComponent(token);
  const translations = {
    en: {
      register: ["Confirm your account email", "Confirm your email address to finish setting up your Deadsmile Games account.", "This one-time link expires in 30 minutes.", "Confirm email", "Account email verification · Link expires in 30 minutes.", "If you did not request this, you can ignore this message."],
      change: ["Confirm your new email address", "You requested to change the email address on your Deadsmile Games account.", "Your current email stays active until the new address is confirmed. This one-time link expires in 30 minutes.", "Confirm new email", "Email change confirmation · Link expires in 30 minutes.", "If you did not request this, you can ignore this message."],
    },
    "pt-BR": {
      register: ["Confirme o e-mail da sua conta", "Confirme seu endereço de e-mail para terminar de configurar sua conta Deadsmile Games.", "Este link de uso único expira em 30 minutos.", "Confirmar e-mail", "Confirmação de conta · Link válido por 30 minutos.", "Se você não solicitou isto, pode ignorar esta mensagem."],
      change: ["Confirme seu novo e-mail", "Você solicitou a alteração do endereço de e-mail da sua conta Deadsmile Games.", "Seu e-mail atual continua ativo até que o novo endereço seja confirmado. Este link de uso único expira em 30 minutos.", "Confirmar novo e-mail", "Confirmação de alteração de e-mail · Link válido por 30 minutos.", "Se você não solicitou isto, pode ignorar esta mensagem."],
    },
    es: {
      register: ["Confirma el correo de tu cuenta", "Confirma tu dirección de correo para terminar de configurar tu cuenta de Deadsmile Games.", "Este enlace de un solo uso caduca en 30 minutos.", "Confirmar correo", "Verificación de cuenta · Enlace válido durante 30 minutos.", "Si no solicitaste esto, puedes ignorar este mensaje."],
      change: ["Confirma tu nuevo correo", "Solicitaste cambiar el correo de tu cuenta de Deadsmile Games.", "Tu correo actual seguirá activo hasta que confirmes la nueva dirección. Este enlace de un solo uso caduca en 30 minutos.", "Confirmar nuevo correo", "Confirmación de cambio de correo · Enlace válido durante 30 minutos.", "Si no solicitaste esto, puedes ignorar este mensaje."],
    },
  };
  const copy = translations[language][purpose === "change" ? "change" : "register"];
  const text = copy[1] + "\n\n" + copy[2] + "\n" + url + "\n\n" + copy[5];
  const html = brandedEmail({
    lang: language, preheader: copy[0], heading: copy[0], intro: copy[1],
    bodyHtml: '<p style="margin:0;color:#b8b8b8;line-height:1.8">' + escapeHtml(copy[2]) + "</p>",
    actionLabel: copy[3], actionUrl: url, footer: copy[4] + " " + copy[5],
  });
  try {
    await sendTransactionalEmail({ to: email, subject: copy[0] + " — Deadsmile Games", text, html });
  } catch (error) {
    await deleteUnsentToken(userId, tokenHash);
    throw error;
  }
}

export async function sendRegistrationEmail(user, locale = "en") {
  await deliverConfirmation({
    userId: user.id,
    purpose: "register",
    email: user.email,
    locale,
  });
}
export async function resendRegistrationEmail({ email, password }, locale = "en") {
  const user = await findUserByEmail(email);

  if (!user) {
    return { sent: true };
  }

  const valid = await verifyPassword(user.password_hash, password);

  if (!valid || user.email_verified_at) {
    return { sent: true };
  }

  await sendRegistrationEmail(user, locale);

  return { sent: true };
}
export async function requestEmailChange(userId, { email, password }, locale = "en") {
  const user = await findUserById(userId);

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND");
  }

  if (!user.email_verified_at) {
    throw new AppError(403, "EMAIL_NOT_VERIFIED");
  }

  if (email === user.email) {
    throw new AppError(400, "EMAIL_UNCHANGED");
  }
  const { rows } = await query("SELECT password_hash FROM users WHERE id = $1", [userId]);

  if (!rows[0] || !(await verifyPassword(rows[0].password_hash, password))) {
    throw new AppError(401, "INVALID_PASSWORD");
  }

  const existing = await findUserByEmail(email);

  if (existing) {
    throw new AppError(409, "EMAIL_TAKEN");
  }
  await deliverConfirmation({
    userId,
    purpose: "change",
    email,
    locale,
  });
  const language = ["en", "pt-BR", "es"].includes(locale) ? locale : "en";
  const notifications = {
    en: { subject: "Email change requested", heading: "Email change requested", intro: "A request was made to change the email address on your Deadsmile Games account.", target: "Requested new address:", unchanged: "Your current email remains unchanged until the new address is confirmed.", security: "If this was not you, change your password and contact support." },
    "pt-BR": { subject: "Alteração de e-mail solicitada", heading: "Alteração de e-mail solicitada", intro: "Foi solicitada uma alteração no endereço de e-mail da sua conta Deadsmile Games.", target: "Novo endereço solicitado:", unchanged: "Seu e-mail atual não será alterado até que o novo endereço seja confirmado.", security: "Se não foi você, altere sua senha e entre em contato com o suporte." },
    es: { subject: "Cambio de correo solicitado", heading: "Cambio de correo solicitado", intro: "Se solicitó cambiar el correo de tu cuenta de Deadsmile Games.", target: "Nueva dirección solicitada:", unchanged: "Tu correo actual no cambiará hasta que se confirme la nueva dirección.", security: "Si no fuiste tú, cambia tu contraseña y contacta con soporte." },
  }[language];
  await sendTransactionalEmail({
    to: user.email,
    subject: notifications.subject + " — Deadsmile Games",
    text: notifications.intro + "\n\n" + notifications.target + " " + email + "\n\n" + notifications.unchanged + "\n\n" + notifications.security,
    html: brandedEmail({
      lang: language, preheader: notifications.subject, heading: notifications.heading, intro: notifications.intro,
      bodyHtml: '<p style="margin:0 0 12px;color:#b8b8b8;line-height:1.8">' + escapeHtml(notifications.target) + '</p><p style="margin:0 0 16px;color:#f0f0f0;line-height:1.8;overflow-wrap:anywhere"><strong>' + escapeHtml(email) + '</strong></p><p style="margin:0 0 16px;color:#b8b8b8;line-height:1.8">' + escapeHtml(notifications.unchanged) + '</p><p style="margin:0;color:#b8b8b8;line-height:1.8">' + escapeHtml(notifications.security) + '</p>',
      footer: "Deadsmile Games · Account security",
    }),
  }).catch((error) => {
    console.error("Old-address notification failed", { code: error?.code || null });
  });

  return { pending: true };
}
export async function confirmAccountEmail(rawToken, locale = "en") {
  const result = await confirmEmailToken(sha256(rawToken));

  if (!result || result.conflict) {
    throw new AppError(400, "EMAIL_CONFIRMATION_INVALID");
  }

  if (result.purpose === "change") {
    const language = ["en", "pt-BR", "es"].includes(locale) ? locale : "en";
    const notifications = {
      en: { subject: "Your account email was changed", intro: "The email address on your Deadsmile Games account was changed.", label: "New account email:", security: "If this was not you, contact support immediately and reset your password." },
      "pt-BR": { subject: "O e-mail da sua conta foi alterado", intro: "O endereço de e-mail da sua conta Deadsmile Games foi alterado.", label: "Novo e-mail da conta:", security: "Se não foi você, entre em contato com o suporte imediatamente e redefina sua senha." },
      es: { subject: "Se cambió el correo de tu cuenta", intro: "Se cambió la dirección de correo de tu cuenta de Deadsmile Games.", label: "Nuevo correo de la cuenta:", security: "Si no fuiste tú, contacta inmediatamente con soporte y restablece tu contraseña." },
    }[language];
    await sendTransactionalEmail({
      to: result.oldEmail,
      subject: notifications.subject + " — Deadsmile Games",
      text: notifications.intro + "\n\n" + notifications.label + " " + result.newEmail + "\n\n" + notifications.security,
      html: brandedEmail({
        lang: language, preheader: notifications.subject, heading: notifications.subject, intro: notifications.intro,
        bodyHtml: '<p style="margin:0 0 10px;color:#b8b8b8;line-height:1.8">' + escapeHtml(notifications.label) + '</p><p style="margin:0 0 16px;color:#f0f0f0;line-height:1.8;overflow-wrap:anywhere"><strong>' + escapeHtml(result.newEmail) + '</strong></p><p style="margin:0;color:#b8b8b8;line-height:1.8">' + escapeHtml(notifications.security) + '</p>',
        footer: "Deadsmile Games · Account security",
      }),
    }).catch((error) => {
      console.error("Email change notification failed", {
        code: error?.code || null,
      });
    });
  }

  return {
    verified: true,
    emailChanged: result.purpose === "change",
  };
}
