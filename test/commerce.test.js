import test from 'node:test';
import assert from 'node:assert/strict';
import { gameOffers, getItchPrice } from '../src/services/game-commerce.service.js';

test('free and paid offers use only their configured stores and never expose a paid download', async (context) => {
  const original = globalThis.fetch;
  context.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => Response.json({ id: 42, price: '$4.50' });
  const game = { access_type: 'free', status: 'released', itch_url: 'https://studio.itch.io/free-offer', purchase_url: 'https://studio.itch.io/free-offer/purchase', itch_game_id: 42, download_url: 'https://downloads.example.test/game.zip', microsoft_product_id: '9P6P8284V337', microsoft_badge_image: 'https://get.microsoft.com/images/en-us%20light.svg' };
  const store = { price: 6.99, currency: 'BRL', storeUrl: 'https://apps.microsoft.com/detail/9P6P8284V337?gl=BR', fetchedAt: '2026-10-09T00:00:00Z', stale: false };
  const free = await gameOffers(game, store);
  assert.deepEqual(free.map((offer) => offer.provider), ['itch', 'microsoft', 'direct']);
  assert.equal(free[0].price.display, '$4.50');
  assert.equal(free[1].price.amount, 6.99);
  const paid = await gameOffers({ ...game, access_type: 'paid' }, store);
  assert.deepEqual(paid.map((offer) => offer.provider), ['itch', 'microsoft']);
  assert.equal(paid[0].href, game.purchase_url);
  assert(!JSON.stringify(paid).includes(game.download_url));
  assert.deepEqual(await gameOffers({ ...game, access_type: 'paid', purchase_url: null, itch_url: null }, null), [{ provider: 'microsoft', href: 'https://apps.microsoft.com/detail/9P6P8284V337', badgeImage: game.microsoft_badge_image.replace('light.svg', 'dark.svg'), price: null }]);
});

test('itch prices are bounded, cached and matched to the configured game', async (context) => {
  const original = globalThis.fetch;
  context.after(() => { globalThis.fetch = original; });
  let calls = 0;
  globalThis.fetch = async (url, options) => { calls++; assert.equal(url, 'https://studio.itch.io/price-test/data.json'); assert.equal(options.redirect, 'error'); return Response.json({ id: 43, price: '<b>$3.00</b>', original_price: '$5.00' }); };
  const [first, second] = await Promise.all([getItchPrice('https://studio.itch.io/price-test/purchase', 43), getItchPrice('https://studio.itch.io/price-test', 43)]);
  assert.deepEqual(first, second); assert.equal(first.display, '$3.00'); assert.equal(calls, 1);
  assert.equal(await getItchPrice('https://studio.itch.io/price-test', 44), null);
  for (const value of ['http://studio.itch.io/game', 'https://127.0.0.1/game', 'https://studio.itch.io.evil.test/game', 'https://u:p@studio.itch.io/game', 'https://studio.itch.io:444/game', 'https://studio.itch.io/game?secret=x']) assert.equal(await getItchPrice(value, 43), null);
  globalThis.fetch = async () => Response.json({ id: 45, price: '$9.00', extra: 'x'.repeat(300000) });
  assert.equal(await getItchPrice('https://studio.itch.io/oversized', 45), null);
  globalThis.fetch = async () => { throw new Error('private provider details'); };
  assert.equal(await getItchPrice('https://studio.itch.io/offline', 46), null);
});
