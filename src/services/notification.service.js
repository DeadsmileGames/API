import { Expo } from 'expo-server-sdk';
import { env } from '../config/env.js';
import { sendTransactionalEmail } from './brevo.service.js';
import { createUnsubscribeToken } from './newsletter.service.js';
import * as repository from '../repositories/engagement.repository.js';
import { signalRealtimeEvent } from '../realtime/hub.js';
import { escapeHtml } from '../utils/html.js';
import { safeAbsoluteUrl } from '../utils/url.js';

const expo = new Expo(env.expoAccessToken ? { accessToken: env.expoAccessToken } : {});

function publicationView(type, item) {
  const id = item.id;
  const title = item.title || 'New from Deadsmile Games';
  const preview = item.excerpt || item.short_description || item.shortDescription || item.description || '';
  const sourceImage = item.image || item.thumbnail || item.cover_image || item.coverImage || null;
  const image = sourceImage ? safeAbsoluteUrl(sourceImage, env.frontendUrl) : null;
  const path = type === 'game' ? `/games/${item.slug}` : type === 'news' ? `/news/${item.slug}` : `/videos/${id}`;
  return {
    id,
    title,
    preview: String(preview).slice(0, 320),
    image,
    url: `${env.frontendUrl}${path}`,
    type,
  };
}

async function deliverEmail(subscriber, view) {
  const token = createUnsubscribeToken(subscriber.id);
  const unsubscribeUrl = `${env.frontendUrl}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
  const imageHtml = view.image
    ? `<img src="${escapeHtml(view.image)}" alt="" style="display:block;width:100%;max-height:300px;object-fit:cover;border-radius:16px;margin:0 0 24px;">`
    : '';
  const html = `<div style="font-family:Arial,sans-serif;background:#0b0b0b;color:#f5f1e8;padding:32px;max-width:620px;margin:auto;border-radius:18px;">${imageHtml}<h1 style="font-size:28px;line-height:1.15;margin:0 0 12px;">${escapeHtml(view.title)}</h1><p style="color:#b9b6af;line-height:1.6;margin:0 0 24px;">${escapeHtml(view.preview)}</p><a href="${escapeHtml(view.url)}" style="display:inline-block;background:#f5f1e8;color:#0b0b0b;padding:13px 20px;border-radius:999px;font-weight:700;text-decoration:none;">View on Deadsmile Games</a><p style="color:#6f6d68;font-size:12px;margin:30px 0 0;">You received this because you confirmed the Deadsmile Games newsletter. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#a9a69f;">Unsubscribe</a></p></div>`;
  const text = `${view.title}\n\n${view.preview}\n\n${view.url}\n\nUnsubscribe: ${unsubscribeUrl}`;
  return sendTransactionalEmail({ to: subscriber.email, subject: view.title, text, html });
}

async function notifyEmailSubscribers(view) {
  if (!env.brevoApiKey || !env.brevoSenderEmail) return;
  const subscribers = await repository.listConfirmedSubscribers();
  for (let index = 0; index < subscribers.length; index += 5) {
    const batch = subscribers.slice(index, index + 5);
    await Promise.allSettled(batch.map((subscriber) => deliverEmail(subscriber, view)));
  }
}

async function notifyPushSubscribers(view) {
  const stored = await repository.listPushTokens();
  const tokens = stored.filter((token) => Expo.isExpoPushToken(token));
  if (!tokens.length) return;
  const messages = tokens.map((to) => ({
    to,
    sound: 'default',
    title: view.title,
    body: view.preview || 'New content is available.',
    data: { url: view.url, type: view.type, id: String(view.id) },
  }));
  const invalid = stored.filter((token) => !Expo.isExpoPushToken(token));
  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, index) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') invalid.push(chunk[index].to);
      });
    } catch {}
  }
  if (invalid.length) await repository.disablePushTokens([...new Set(invalid)]);
}

export async function publishContentEvent(type, item) {
  const view = publicationView(type, item);
  const event = await repository.createEvent({
    eventType: `${type}.published`,
    entityId: view.id,
    payload: view,
  });
  await signalRealtimeEvent(event);
  await Promise.allSettled([notifyEmailSubscribers(view), notifyPushSubscribers(view)]);
  return event;
}

export async function publishWishlistEvent(userId, gameId, inWishlist) {
  const event = await repository.createEvent({
    eventType: 'wishlist.updated',
    audienceUserId: userId,
    entityId: gameId,
    payload: { gameId, inWishlist },
  });
  await signalRealtimeEvent(event);
  return event;
}
