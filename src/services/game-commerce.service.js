import sanitizeHtml from 'sanitize-html';
import { isHttpsUrl, isItchHttpsUrl } from '../utils/url.js';
import { storeBadgeFromRow } from '../utils/storeBadge.js';

const prices = new Map();
const pending = new Map();

function gamePage(value) {
  if (!isItchHttpsUrl(value)) return null;
  const url = new URL(value);
  if (!/^[a-z0-9-]+\.itch\.io$/.test(url.hostname) || url.port || url.search || url.hash) return null;
  const match = url.pathname.match(/^\/([a-z0-9-]+)(?:\/purchase)?\/?$/i);
  return match ? `${url.origin}/${match[1]}` : null;
}

const priceText = (value) => typeof value === 'string' && value.length <= 80
  ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim() : null;

export async function getItchPrice(value, gameId) {
  const page = gamePage(value);
  if (!page) return null;
  const key = `${page}:${gameId || ""}`;
  const cached = prices.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (!pending.has(key)) {
    pending.set(key, (async () => {
      let price = null;
      try {
        const response = await fetch(`${page}/data.json`, {
          headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(4000),
        });
        if (!response.ok || !/application\/json/i.test(response.headers.get('content-type') || '')) {
          await response.body?.cancel();
          throw new Error();
        }
        const reader = response.body.getReader();
        const chunks = [];
        let size = 0;
        try {
          for (;;) {
            const { done, value: chunk } = await reader.read();
            if (done) break;
            size += chunk.byteLength;
            if (size > 256 * 1024) throw new Error();
            chunks.push(Buffer.from(chunk));
          }
        } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (gameId && String(data.id) !== String(gameId)) throw new Error();
        const display = priceText(data.price);
        if (display && /\d/.test(display)) price = { display, originalDisplay: priceText(data.original_price), source: 'itch.io', fetchedAt: new Date().toISOString() };
      } catch {}
      if (prices.size >= 256) prices.delete(prices.keys().next().value);
      prices.set(key, { value: price, expiresAt: Date.now() + 60_000 });
      return price;
    })().finally(() => pending.delete(key)));
  }
  return pending.get(key);
}

export async function gameOffers(game, microsoftStore, itchPrice) {
  const free = game.access_type === 'free';
  const itchUrl = free ? game.itch_url || game.purchase_url : game.purchase_url || game.itch_url;
  const badge = storeBadgeFromRow(game);
  const offers = [];
  if (isItchHttpsUrl(itchUrl)) offers.push({
    provider: 'itch', href: itchUrl, price: itchPrice === undefined ? await getItchPrice(itchUrl, game.itch_game_id) : itchPrice,
  });
  if (badge) offers.push({
    provider: 'microsoft', href: microsoftStore?.storeUrl || `https://apps.microsoft.com/detail/${badge.productId}`,
    badgeImage: badge.imageUrl,
    price: microsoftStore && typeof microsoftStore.price === 'number' && /^[A-Z]{3}$/.test(microsoftStore.currency)
      ? { amount: microsoftStore.price, currency: microsoftStore.currency, source: 'microsoft-store', fetchedAt: microsoftStore.fetchedAt, stale: microsoftStore.stale } : null,
  });
  if (free && game.status === 'released' && isHttpsUrl(game.download_url)) offers.push({ provider: 'direct', href: null, price: null });
  return offers;
}
