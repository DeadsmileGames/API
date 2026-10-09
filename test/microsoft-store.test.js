import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeMicrosoftProduct, storeUrl, packageVersion } from '../src/utils/microsoftProduct.js';

const edge = JSON.parse(await readFile(new URL('./fixtures/store-edge.json', import.meta.url)));
const catalog = JSON.parse(await readFile(new URL('./fixtures/store-catalog.json', import.meta.url)));
const region = { market: 'BR', locale: 'pt-BR' };
const id = '9P6P8284V337';

test('real Store payload extracts localized ratings, screenshots and exact package version without inventing downloads', () => {
  const product = normalizeMicrosoftProduct(id, edge, catalog, region);
  assert.equal(product.title, 'Deadsmile Games Launcher');
  assert.equal(product.primaryRating.id, 'DJCTQ:14');
  assert.equal(product.primaryRating.age, 14);
  assert(product.primaryRating.interactiveElements.includes('Compras no Aplicativo'));
  assert(product.ratings.some((item) => item.id === 'ESRB:E'));
  assert.equal(product.screenshots.length, 2);
  assert.equal(product.version, '1.0.0.0');
  assert.equal(product.price, 0);
  assert.equal(product.isFree, true);
  assert.equal(product.downloadCount, null);
  assert(product.releaseNotes[0]);
  assert(product.requirements[0].items.some((item) => item.value.includes('Windows 10')));
  assert(!JSON.stringify(product).includes('PublisherCertificateName'));
  assert(!JSON.stringify(product).includes('PackageUri'));
});

test('catalog alone remains usable and unknown or mismatched products cannot supply metadata', () => {
  const product = normalizeMicrosoftProduct(id, null, catalog, region);
  assert.equal(product.title, 'Deadsmile Games Launcher');
  assert.equal(product.isFree, true);
  assert.equal(product.screenshots.length, 2);
  assert.equal(product.version, '1.0.0.0');
  assert.equal(normalizeMicrosoftProduct('9INVALID0000', edge, catalog, region), null);
  assert.equal(product.primaryRating.id, 'DJCTQ:14');
  assert.equal(normalizeMicrosoftProduct(id, {}, {}, region), null);
});

test('free trials never determine the price and missing pricing remains unknown', () => {
  const modified = structuredClone(edge);
  modified.Payload.Skus[0].Availabilities[0].Price = 10;
  assert.equal(normalizeMicrosoftProduct(id, modified, null, region).isFree, false);
  modified.Payload.Skus = modified.Payload.Skus.filter((item) => item.SkuType === 'trial');
  modified.Payload.Price = 0;
  assert.equal(normalizeMicrosoftProduct(id, modified, null, region).isFree, null);
  const future = structuredClone(edge);
  future.Payload.Skus[0].Availabilities[0].Conditions.StartDate = '2099-01-01T00:00:00Z';
  assert.equal(normalizeMicrosoftProduct(id, future, null, region).isFree, null);
});

test('remote Store text and media reject executable content, credentials and untrusted image hosts', () => {
  const modified = structuredClone(edge);
  modified.Payload.Description = '<script>alert(1)</script><b>Safe text</b>';
  modified.Payload.PrivacyUrl = 'javascript:alert(1)';
  modified.Payload.Images = [{ Url: 'https://attacker.test/track', ImageType: 'screenshot' }];
  modified.Payload.ProductRatings[0].RatingValueLogoUrl = 'https://store-images.s-microsoft.com@attacker.test/logo';
  const product = normalizeMicrosoftProduct(id, modified, null, region);
  assert.equal(product.description, 'Safe text');
  assert.equal(product.privacyUrl, null);
  assert.deepEqual(product.screenshots, []);
  assert.equal(product.primaryRating.imageUrl, null);
  for (const url of ['http://store-images.s-microsoft.com/x', 'https://u:p@store-images.s-microsoft.com/x', 'https://store-images.s-microsoft.com:444/x', 'https://store-images.s-microsoft.com\\@attacker.test/x']) assert.equal(storeUrl(url, true), null);
});

test('Windows packed versions retain all 16-bit components', () => {
  assert.equal(packageVersion('281474976710656'), '1.0.0.0');
  assert.equal(packageVersion('18446744073709551615'), '65535.65535.65535.65535');
  assert.equal(packageVersion('18446744073709551616'), null);
  assert.equal(packageVersion('invalid'), null);
});
