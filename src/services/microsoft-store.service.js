import { query } from '../config/database.js';
import { resolveLocale } from '../utils/publicErrors.js';
import { AppError } from '../utils/AppError.js';
import { normalizeMicrosoftProduct } from '../utils/microsoftProduct.js';

export const LAUNCHER_PRODUCT_ID = '9P6P8284V337';
const TTL = 60 * 60 * 1000;
const STALE_LIMIT = 7 * 24 * TTL;
const pending = new Map();
const retries = new Map();
const regions = { 'pt-BR': { market: 'BR', locale: 'pt-BR' }, en: { market: 'US', locale: 'en-US' }, es: { market: 'ES', locale: 'es-ES' } };

async function requestJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(7000), redirect: 'error', headers: { Accept: 'application/json' } });
  if (!response.ok || !/application\/json/i.test(response.headers.get('content-type') || '')) throw new AppError(502, 'MICROSOFT_STORE_UNAVAILABLE');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) throw new AppError(502, 'MICROSOFT_STORE_UNAVAILABLE');
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

function result(row, stale = false) {
  return { ...row.metadata, fetchedAt: new Date(row.fetched_at).toISOString(), stale };
}

export async function getMicrosoftProduct(productId, language = 'en', { optional = false, requireFresh = false } = {}) {
  if (!/^[A-Z0-9]{12}$/.test(productId || '')) throw new AppError(400, 'VALIDATION_ERROR');
  const region = regions[resolveLocale(language)];
  const key = `${productId}:${region.market}:${region.locale}`;
  const cached = (await query('SELECT metadata,fetched_at FROM microsoft_store_products WHERE product_id=$1 AND market=$2 AND locale=$3', [productId, region.market, region.locale])).rows[0];
  const age = cached ? Date.now() - new Date(cached.fetched_at).getTime() : Infinity;
  if (age < TTL && !requireFresh) return result(cached);
  if (!pending.has(key) && (!retries.has(key) || retries.get(key) <= Date.now())) {
    const refresh = (async () => {
      const [edge, catalog] = await Promise.allSettled([
        requestJson(`https://storeedgefd.dsx.mp.microsoft.com/v9.0/products/${productId}?market=${region.market}&locale=${region.locale}&deviceFamily=Windows.Desktop`),
        requestJson(`https://displaycatalog.mp.microsoft.com/v7.0/products/${productId}?market=${region.market}&languages=${region.locale}`),
      ]);
      const metadata = normalizeMicrosoftProduct(productId, edge.status === 'fulfilled' ? edge.value : null, catalog.status === 'fulfilled' ? catalog.value : null, region);
      if (!metadata) throw new AppError(502, 'MICROSOFT_STORE_UNAVAILABLE');
      const stored = await query(`INSERT INTO microsoft_store_products(product_id,market,locale,metadata) VALUES($1,$2,$3,$4)
        ON CONFLICT(product_id,market,locale) DO UPDATE SET metadata=EXCLUDED.metadata,fetched_at=now() RETURNING metadata,fetched_at`, [productId, region.market, region.locale, metadata]);
      retries.delete(key);
      return result(stored.rows[0]);
    })().catch((error) => {
      if (retries.size > 512) retries.delete(retries.keys().next().value);
      retries.set(key, Date.now() + 60000);
      throw error;
    }).finally(() => pending.delete(key));
    pending.set(key, refresh);
  }
  try {
    if (pending.has(key)) return await pending.get(key);
    throw new AppError(502, 'MICROSOFT_STORE_UNAVAILABLE');
  } catch (error) {
    if (!requireFresh && age < STALE_LIMIT) return result(cached, true);
    if (optional && error?.code === 'MICROSOFT_STORE_UNAVAILABLE') return null;
    throw new AppError(502, 'MICROSOFT_STORE_UNAVAILABLE');
  }
}
