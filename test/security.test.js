import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStoreBadge } from '../src/utils/storeBadge.js';
import { sanitizeContent } from '../src/utils/contentHtml.js';
import { publicErrorMessage, resolveLocale, errorCatalog } from '../src/utils/publicErrors.js';
import { gamePostSchema } from '../src/validators/admin.validators.js';

const badge = '<a href="https://get.microsoft.com/installer/download/9P6P8284V337?referrer=appbadge" target="_self" aria-label="Get it from Microsoft Store"><img src="https://get.microsoft.com/images/en-us%20light.svg" width="200" alt="Get it from Microsoft Store" loading="lazy"></a>';
test('Microsoft badge is reduced to safe official data', () => {
 assert.deepEqual(parseStoreBadge(badge), { productId:'9P6P8284V337', href:'https://get.microsoft.com/installer/download/9P6P8284V337?referrer=appbadge', imageUrl:'https://get.microsoft.com/images/en-us%20light.svg' });
 assert.equal(parseStoreBadge(null), null);
 const safe = parseStoreBadge(badge.replace('width="200"','onerror="alert(document.cookie)" width="200"'));
 assert.equal(Object.keys(safe).length,3);
});
test('forged Microsoft badge links, credentials and extra markup fail closed', () => {
 for(const input of [badge.replace('get.microsoft.com/installer','get.microsoft.com.evil.test/installer'),badge.replace('https://get.microsoft.com/installer','https://evil@get.microsoft.com/installer'),badge.replace('https://get.microsoft.com/installer','javascript:alert(1)//'),badge+'<script>alert(1)</script>',badge+badge,badge.replace('light.svg','light.svg?payload=1'),badge.replace('appbadge','appbadge&url=https://evil.test')]) assert.throws(()=>parseStoreBadge(input),{code:'INVALID_STORE_BADGE'});
});
test('newsletter HTML removes executable tags, dangerous URLs and handlers', () => {
 const clean = sanitizeContent('<p onclick="alert(1)">Story <strong>ok</strong></p><script>secret()</script><svg onload="alert(1)"></svg><iframe src="https://evil.test"></iframe><a href="javascript:alert(1)">bad</a><a href="https://itch.io">good</a><img src=x onerror=alert(1)>');
 assert.match(clean,/<strong>ok<\/strong>/); assert.doesNotMatch(clean,/onclick|onload|onerror|javascript:|<script|<svg|<iframe|<img|secret\(\)/);
 assert.match(clean,/noopener noreferrer/);
});
test('free games can have an itch URL without a purchase; paid games require ownership configuration', () => {
 const base={title:'Free game',slug:'free-game',shortDescription:'Game',accessType:'free',itchUrl:'https://studio.itch.io/free',itchGameId:2000};
 assert.equal(gamePostSchema.safeParse(base).success,true);
 assert.equal(gamePostSchema.safeParse({...base,accessType:'paid'}).success,false);
 assert.equal(gamePostSchema.safeParse({...base,accessType:'paid',purchaseUrl:'https://studio.itch.io/free/purchase'}).success,true);
 assert.equal(gamePostSchema.safeParse({...base,accessType:undefined}).success,false);
 assert.equal(gamePostSchema.safeParse({...base,itchUrl:'https://studio.itch.io.evil.test/free'}).success,false);
});
test('errors use the negotiated locale and never reveal an exception', () => {
 assert.equal(resolveLocale('de;q=1,pt-PT;q=0.9,en;q=0.5'),'pt-BR');
 assert.equal(resolveLocale('es-MX'),'es');
 assert.equal(resolveLocale('zh'),'en');
 assert.match(publicErrorMessage('INVALID_CREDENTIALS',401,'pt-BR'),/senha/);
 assert.match(publicErrorMessage('INVALID_CREDENTIALS',401,'es'),/contraseña/);
 assert.equal(publicErrorMessage('password=secret',500,'pt-BR'),errorCatalog('pt-BR').INTERNAL_ERROR);
 assert.deepEqual(Object.keys(errorCatalog('en')),Object.keys(errorCatalog('pt-BR')));
 assert.deepEqual(Object.keys(errorCatalog('en')),Object.keys(errorCatalog('es')));
});
