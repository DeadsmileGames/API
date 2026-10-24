import crypto from "node:crypto";
import { AppError } from "../utils/AppError.js";
import { env } from "../config/env.js";
import { sendTransactionalEmail } from "./brevo.service.js";
import * as repository from "../repositories/engagement.repository.js";
import { brandedEmail } from "./email-template.js";

function hash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function sign(value) {
  return crypto.createHmac("sha256", env.sessionSecret).update(value).digest("hex");
}

export function createUnsubscribeToken(subscriberId) {
  const value = `v1.${subscriberId}`;
  return `${value}.${sign(`newsletter-unsubscribe:${value}`)}`;
}

function parseUnsubscribeToken(token) {
  const match = /^v1\.([0-9a-f-]{36})\.([a-f0-9]{64})$/i.exec(String(token || ""));
  if (!match) return null;
  const value = `v1.${match[1]}`;
  const expected = Buffer.from(sign(`newsletter-unsubscribe:${value}`), "hex");
  const received = Buffer.from(match[2], "hex");
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received))
    return null;
  return match[1];
}

export async function subscribe(email, locale = "en", consentTextVersion) {
  const normalized = email.trim().toLowerCase();
  const language = ["en", "pt-BR", "es"].includes(locale) ? locale : "en";
  const confirmationToken = crypto.randomBytes(32).toString("hex");
  const subscriber = await repository.upsertNewsletterSubscriber({
    email: normalized,
    confirmationTokenHash: hash(confirmationToken),
    consentTextVersion,
    consentLocale: language,
    consentSource: "website-footer",
  });

  if (subscriber.confirmed_at && !subscriber.unsubscribed_at) return { received: true };

  const confirmationUrl = `${env.frontendUrl}/newsletter/confirm?token=${encodeURIComponent(confirmationToken)}`;
  const copy = {
    en: {
      subject: "Confirm your Deadsmile Games newsletter",
      preheader: "Confirm your email to receive games, Newswire stories and videos.",
      heading: "Confirm your subscription",
      intro: "Confirm this address to receive new games, Newswire stories and videos from Deadsmile Games.",
      action: "Confirm email",
      footer: "Newsletter subscription confirmation",
      ignore: "If you did not request this, you can ignore this message.",
    },
    "pt-BR": {
      subject: "Confirme sua newsletter da Deadsmile Games",
      preheader: "Confirme seu e-mail para receber jogos, notícias e vídeos.",
      heading: "Confirme sua inscrição",
      intro: "Confirme este endereço para receber novidades sobre jogos, notícias e vídeos da Deadsmile Games.",
      action: "Confirmar e-mail",
      footer: "Confirmação de inscrição na newsletter",
      ignore: "Se você não solicitou esta inscrição, pode ignorar esta mensagem.",
    },
    es: {
      subject: "Confirma tu boletín de Deadsmile Games",
      preheader: "Confirma tu correo para recibir juegos, noticias y vídeos.",
      heading: "Confirma tu suscripción",
      intro: "Confirma esta dirección para recibir novedades sobre juegos, artículos y vídeos de Deadsmile Games.",
      action: "Confirmar correo",
      footer: "Confirmación de suscripción al boletín",
      ignore: "Si no solicitaste esta suscripción, puedes ignorar este mensaje.",
    },
  }[language];
  const text = copy.intro + "\n\n" + confirmationUrl + "\n\n" + copy.ignore;
  const html = brandedEmail({
    lang: language,
    preheader: copy.preheader,
    heading: copy.heading,
    intro: copy.intro,
    actionLabel: copy.action,
    actionUrl: confirmationUrl,
    footer: copy.ignore,
  });
  await sendTransactionalEmail({
    to: normalized,
    subject: copy.subject,
    text,
    html,
  });
  return { received: true };
}

export async function confirm(token) {
  const subscriber = await repository.confirmNewsletter(hash(token));
  if (!subscriber) throw new AppError(400, "NEWSLETTER_LINK_INVALID");
  return { confirmed: true };
}

export async function unsubscribe(token) {
  const subscriberId = parseUnsubscribeToken(token);
  const subscriber = subscriberId
    ? await repository.unsubscribeNewsletterById(subscriberId)
    : await repository.unsubscribeNewsletterLegacy(token);
  if (!subscriber) throw new AppError(400, "NEWSLETTER_LINK_INVALID");
  return { unsubscribed: true };
}
