import crypto from 'node:crypto';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';
import { sendTransactionalEmail } from './brevo.service.js';
import * as repository from '../repositories/engagement.repository.js';
import { escapeHtml } from '../utils/html.js';

function hash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function sign(value) {
  return crypto.createHmac('sha256', env.sessionSecret).update(value).digest('hex');
}

export function createUnsubscribeToken(subscriberId) {
  const value = `v1.${subscriberId}`;
  return `${value}.${sign(`newsletter-unsubscribe:${value}`)}`;
}

function parseUnsubscribeToken(token) {
  const match = /^v1\.([0-9a-f-]{36})\.([a-f0-9]{64})$/i.exec(String(token || ''));
  if (!match) return null;
  const value = `v1.${match[1]}`;
  const expected = Buffer.from(sign(`newsletter-unsubscribe:${value}`), 'hex');
  const received = Buffer.from(match[2], 'hex');
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;
  return match[1];
}

export async function subscribe(email) {
  const normalized = email.trim().toLowerCase();
  const confirmationToken = crypto.randomBytes(32).toString('hex');
  const subscriber = await repository.upsertNewsletterSubscriber({
    email: normalized,
    confirmationTokenHash: hash(confirmationToken),
  });

  if (subscriber.confirmed_at && !subscriber.unsubscribed_at) return { received: true };

  const confirmationUrl = `${env.frontendUrl}/newsletter/confirm?token=${encodeURIComponent(confirmationToken)}`;
  const html = `<div style="font-family:Arial,sans-serif;background:#0b0b0b;color:#f5f1e8;padding:32px;max-width:560px;margin:auto;border-radius:18px;"><h1 style="font-size:28px;line-height:1.15;margin:0 0 12px;">Confirm your subscription</h1><p style="color:#b9b6af;line-height:1.6;margin:0 0 24px;">Confirm this address to receive new games, Newswire stories and videos from Deadsmile Games.</p><a href="${escapeHtml(confirmationUrl)}" style="display:inline-block;background:#f5f1e8;color:#0b0b0b;padding:13px 20px;border-radius:999px;font-weight:700;text-decoration:none;">Confirm email</a><p style="color:#6f6d68;font-size:12px;margin:30px 0 0;">If you did not request this, you can ignore this message.</p></div>`;
  await sendTransactionalEmail({
    to: normalized,
    subject: 'Confirm your Deadsmile Games newsletter',
    text: `Confirm your Deadsmile Games newsletter:\n\n${confirmationUrl}\n\nIf you did not request this, ignore this message.`,
    html,
  });
  return { received: true };
}

export async function confirm(token) {
  const subscriber = await repository.confirmNewsletter(hash(token));
  if (!subscriber) throw new AppError(400, 'NEWSLETTER_LINK_INVALID', 'This confirmation link is invalid or has already been used.');
  return { confirmed: true };
}

export async function unsubscribe(token) {
  const subscriberId = parseUnsubscribeToken(token);
  const subscriber = subscriberId
    ? await repository.unsubscribeNewsletterById(subscriberId)
    : await repository.unsubscribeNewsletterLegacy(token);
  if (!subscriber) throw new AppError(400, 'NEWSLETTER_LINK_INVALID', 'This unsubscribe link is invalid or has already been used.');
  return { unsubscribed: true };
}
