import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const originalFetch = globalThis.fetch;
let revoked = false;
let calls = [];
let storePaid = false;
let storeOffline = false;
const storeEdge = JSON.parse(await readFile(new URL('./fixtures/store-edge.json', import.meta.url), 'utf8'));
const storeCatalog = JSON.parse(await readFile(new URL('./fixtures/store-catalog.json', import.meta.url), 'utf8'));
const db = await PGlite.create({extensions:{pg_trgm}});
await db.exec(await readFile(new URL('../src/database/schema.sql',import.meta.url),'utf8'));
const socket = new PGLiteSocketServer({db,port:0,host:'127.0.0.1',maxConnections:20});
await socket.start();
process.env.DATABASE_URL=`postgres://postgres:postgres@${socket.getServerConn()}/postgres`;
process.env.SESSION_SECRET='isolated-test-session-key-'.repeat(2);
process.env.DATA_ENCRYPTION_KEY='isolated-test-data-key-'.repeat(2);
process.env.ITCH_CLIENT_ID='test-client';
process.env.ITCH_TOKEN_ENCRYPTION_KEY='isolated-test-itch-key-'.repeat(2);
process.env.ITCH_REDIRECT_URI='https://api.example.test/callback';
process.env.VERCEL='1';
process.env.NODE_ENV='development';
const {pool}=await import('../src/config/database.js');
const {hashPassword}=await import('../src/utils/password.js');
const {encryptToken}=await import('../src/utils/tokenCipher.js');
const {createApp, default: unusedServer}=await import('../src/app.js');
const app=createApp();
const server=app.listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const base=`http://127.0.0.1:${server.address().port}/api`;
globalThis.fetch=async(input,options)=>{
 const url=String(input);
 if(url.startsWith(base)) return originalFetch(input,options);
 calls.push(url);
 if (/^https:\/\/(?:storeedgefd.dsx|displaycatalog).mp.microsoft.com\//.test(url)) {
  if (storeOffline) throw new Error('provider unavailable');
  const value = structuredClone(url.includes('storeedgefd') ? storeEdge : storeCatalog);
  if (storePaid) { if (value.Payload) value.Payload.Skus[0].Availabilities[0].Price = 5; if (value.Product) value.Product.DisplaySkuAvailabilities[0].Availabilities[0].OrderManagementData.Price.ListPrice = 5; }
  return Response.json(value);
 }
 if(url.includes('/profile/owned-keys')) {
  const page=Number(new URL(url).searchParams.get('page')||1);
  return Response.json({per_page:50,owned_keys:revoked || page>2?[]:[{id:800+page,game_id:page===1?999:1000}]});
 }
 if(url.endsWith('/data.json')) return Response.json({id:url.includes('/paid/')?1000:2000,price:url.includes('/paid/')?'$4.99':'$0.00'});
 if(url.endsWith('/profile/games')) return Response.json({games:[{id:2000,min_price:0,published:true}]});
 if(url.endsWith('/games/2000/uploads')) return Response.json({uploads:[{id:700,filename:'free-v100.zip',p_windows:true,size:100,min_price:0},{id:701,filename:'paid-extra.zip',p_windows:true,size:100,min_price:1000}]});
 if(url.endsWith('/uploads/700/download')) return Response.json({url:'https://uploads.itch.zone/free-v100.zip'});
 throw new Error('Unmocked external request');
};
const userId='00000000-0000-4000-8000-000000000001';
const otherId='00000000-0000-4000-8000-000000000002';
const adminId='00000000-0000-4000-8000-000000000003';
const freeId='00000000-0000-4000-8000-000000000004';
const paidId='00000000-0000-4000-8000-000000000005';
const msId='00000000-0000-4000-8000-000000000006';
const password=await hashPassword('TestPassword123!');
for(const [id,username,role] of [[userId,'player','user'],[otherId,'other','user'],[adminId,'admin','admin']]) await pool.query('INSERT INTO users(id,email,username,password_hash,role,email_verified_at) VALUES($1,$2,$3,$4,$5,now())',[id,`${username}@example.test`,username,password,role]);
await pool.query(`INSERT INTO games(id,title,slug,short_description,status,access_type,itch_game_id,itch_url,cloud_saves_enabled) VALUES($1,'Free','free','free','released','free',2000,'https://studio.itch.io/free',true)`,[freeId]);
await pool.query(`INSERT INTO games(id,title,slug,short_description,status,access_type,itch_game_id,purchase_url) VALUES($1,'Paid','paid','paid','released','paid',1000,'https://studio.itch.io/paid/purchase')`,[paidId]);
await pool.query(`INSERT INTO games(id,title,slug,short_description,status,access_type,microsoft_product_id,microsoft_badge_image) VALUES($1,'Store','store','store','released','free','9P6P8284V337','https://get.microsoft.com/images/en-us%20light.svg')`,[msId]);
function client() {
 const cookies=new Map();let token;
 return {cookies,async request(path,{method='GET',body,csrf=true,language='en',rawBody}={}){
  if(method!=='GET'&&csrf&&!token) { const result=await this.request('/csrf');token=result.body.data.token; }
  const response=await fetch(base+path,{method,headers:{Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),'Accept-Language':language,...(body!==undefined||rawBody?{'Content-Type':'application/json'}:{}),...(method!=='GET'&&csrf?{'X-CSRF-Token':token}:{})},body:rawBody|| (body!==undefined?JSON.stringify(body):undefined)});
  for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';')[0];const i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));}
  return {status:response.status,body:await response.json(),headers:response.headers};
 },async login(username){const result=await this.request('/auth/mobile-login',{method:'POST',body:{email:`${username}@example.test`,password:'TestPassword123!'}});assert.equal(result.status,200,JSON.stringify(result.body));}}
}
const player=client(),other=client(),admin=client(),guest=client();
await player.login('player');await other.login('other');await admin.login('admin');
test.after(async()=>{globalThis.fetch=originalFetch;await new Promise(r=>server.close(r));unusedServer.close();await pool.end();await socket.stop();await db.close();});

test('catalog exposes paid games without granting ownership and free additions are explicit and scoped', async () => {
 const initial = await other.request('/library/catalog');
 assert.equal(initial.status, 200); assert.equal(initial.headers.get('cache-control'), 'no-store');
 const paid = initial.body.data.items.find((game) => game.id === paidId);
 assert.equal(paid.accessType, 'paid'); assert.equal(paid.owned, false); assert.equal(paid.inLibrary, false);
 const free = initial.body.data.items.find((game) => game.id === msId);
 assert.equal(free.accessType, 'free'); assert.equal(free.owned, true); assert.equal(free.inLibrary, false);
 assert.equal((await guest.request('/library/catalog')).status, 401);
 assert.equal((await guest.request(`/library/${msId}`, { method: 'POST' })).status, 401);
 const count = calls.length;
 for (let index = 0; index < 2; index++) {
  const added = await other.request(`/library/${msId}`, { method: 'POST', body: { userId, owned: true } });
  assert.equal(added.status, 200); assert.equal(added.body.data.inLibrary, true);
 }
 assert.equal(calls.length, count);
 const rows = await pool.query('SELECT user_id,source,revoked_at FROM user_game_entitlements WHERE game_id=$1', [msId]);
 assert.equal(rows.rows.length, 1); assert.equal(rows.rows[0].user_id, otherId); assert.equal(rows.rows[0].source, 'free'); assert.equal(rows.rows[0].revoked_at, null);
 assert((await other.request('/library')).body.data.items.some((game) => game.id === msId));
 assert(!(await player.request('/library')).body.data.items.some((game) => game.id === msId));
 const forged = await other.request(`/library/${paidId}`, { method: 'POST', body: { userId, owned: true, accessType: 'free' } });
 assert.equal(forged.status, 409); assert.equal(forged.body.error.code, 'ITCH_NOT_CONNECTED');
 assert(!(await other.request('/library')).body.data.items.some((game) => game.id === paidId));
});

test('launcher metadata uses locale-specific persistent caching and game details share the Store model', async () => {
 const first = await guest.request('/launcher', { language: 'pt-BR' });
 assert.equal(first.status, 200); assert.equal(first.body.data.locale, 'pt-BR'); assert.equal(first.body.data.market, 'BR');
 assert.equal(first.body.data.version, '1.0.0.0'); assert.equal(first.body.data.primaryRating.id, 'DJCTQ:14'); assert.equal(first.body.data.downloadCount, null);
 assert.equal(first.headers.get('content-language'), 'pt-BR');
 const count = calls.length;
 const second = await guest.request('/launcher', { language: 'pt-BR' });
 assert.equal(second.status, 200); assert.equal(calls.length, count);
 const detail = await guest.request('/games/store', { language: 'pt-BR' });
 assert.equal(detail.status, 200); assert.equal(detail.body.data.microsoftStore.productId, '9P6P8284V337');
 assert(!JSON.stringify(detail.body).includes('PackageUri'));
});

test('launcher refuses Store or itch-only installation without the game database download link', async () => {
 for (const id of [freeId, msId]) {
  const install = await player.request(`/library/${id}/install-metadata`, { method: 'POST', language: 'pt-BR' });
  assert.equal(install.status, 409); assert.equal(install.body.error.code, 'GAME_RELEASE_NOT_CONFIGURED');
 }
 const result=await player.request(`/library/${freeId}/verify`,{method:'POST'});assert.equal(result.status,200);assert.equal(result.body.data.owned,true);
 const library=await player.request('/library');assert(!library.body.data.items.some((item)=>item.id===freeId));assert(!library.body.data.items.some((item)=>item.id===msId));
 assert(library.body.data.items.every((item)=>item.downloadUrl===null));
});

test('paid ownership checks all pages, including short pages, and revokes removed ownership',async()=>{
 let result=await player.request(`/library/${paidId}/verify`,{method:'POST'});assert.equal(result.status,409);assert.equal(result.body.error.code,'ITCH_NOT_CONNECTED');
 await pool.query('INSERT INTO user_itch_accounts(user_id,itch_user_id,itch_username,access_token_encrypted) VALUES($1,1234,\'test\',$2)',[userId,encryptToken('test-token')]);
 result=await player.request(`/library/${paidId}/verify`,{method:'POST'});assert.equal(result.status,200);assert.equal(result.body.data.owned,true);assert(calls.some(x=>x.includes('page=3')));
 revoked=true;result=await player.request('/platform/sessions',{method:'POST',body:{gameId:paidId,platform:'windows'}});assert.equal(result.status,403);assert.equal(result.body.error.code,'GAME_ACCESS_REQUIRED');
 const library=await player.request('/library');assert(!library.body.data.items.some(x=>x.id===paidId));revoked=false;
});

test('website downloads use the database link for free games and recheck paid ownership on itch.io', async () => {
 await pool.query('UPDATE games SET download_url=$2 WHERE id=ANY($1::uuid[])', [[freeId, paidId], 'https://downloads.example.test/game.zip']);
 try {
  const free = await guest.request('/games/free/download');
  assert.equal(free.status, 200);
  assert.equal(free.body.data.downloadUrl, 'https://downloads.example.test/game.zip');
  assert.equal(free.headers.get('cache-control'), 'no-store');
  const publicPaid = await guest.request('/games/paid');
  assert.equal(publicPaid.body.data.downloadUrl, null);
  assert.equal(publicPaid.body.data.downloadAvailable, true);
  assert.equal((await guest.request('/games/paid/download')).status, 401);
  assert.equal((await other.request('/games/paid/download')).body.error.code, 'ITCH_NOT_CONNECTED');
  assert.equal((await player.request('/games/paid/download')).status, 200);
  revoked = true;
  const denied = await player.request('/games/paid/download', { language: 'pt-BR' });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error.code, 'GAME_NOT_OWNED');
  assert.equal(denied.body.error.locale, 'pt-BR');
 } finally { revoked = false; await pool.query('UPDATE games SET download_url=null WHERE id=ANY($1::uuid[])', [[freeId, paidId]]); }
});

test('game validation identifies the rejected field in each locale without echoing its value', async () => {
 const payload = { title: 'Invalid game', slug: 'Invalid Slug', shortDescription: 'Game', accessType: 'free', heroImage: 'javascript:PRIVATE_SENTINEL' };
 for (const language of ['en', 'pt-BR', 'es']) {
  const response = await admin.request('/admin/game', { method: 'POST', language, body: payload });
  assert.equal(response.status, 400); assert.equal(response.body.error.locale, language);
  assert.deepEqual(response.body.error.fields.map((item) => item.field), ['slug', 'heroImage']);
  assert(response.body.error.fields.every((item) => item.message));
  assert(!JSON.stringify(response.body).includes('PRIVATE_SENTINEL'));
 }
});

test('newswire returns the persisted original in every interface language', async () => {
 const created = await admin.request('/admin/newsletter', { method: 'POST', body: { title: 'English original', body: '<p>English story.</p>' } });
 for (const language of ['en', 'pt-BR', 'es']) {
  const original = await guest.request(`/newswire/${created.body.data.slug}`, { language });
  assert.equal(original.body.data.title, 'English original');
  assert.equal(original.body.data.body, '<p>English story.</p>');
  assert.equal(Object.hasOwn(original.body.data, 'translation'), false);
 }
 assert.equal((await pool.query('SELECT body FROM news WHERE id=$1', [created.body.data.id])).rows[0].body, '<p>English story.</p>');
});
test('itch callback reuses website CSS and ships bounded accessible connection states', async () => {
 const origin = new URL(base).origin;
 const response = await originalFetch(`${base}/integrations/itch/callback`);
 assert.equal(response.status, 200);
 assert.equal(response.headers.get('cache-control'), 'no-store');
 const html = await response.text();
 assert(html.includes('href="/styles/global.css"'));
 assert(html.includes('newsletter-action__card'));
 assert(html.includes('aria-busy="true"'));
 assert(!html.includes('callback-card'));
 assert.equal(await (await originalFetch(`${origin}/styles/global.css`)).text(), await readFile(new URL('../public/styles/global.css', import.meta.url), 'utf8'));
 assert.equal((await originalFetch(`${origin}/fonts/Berlin-Sans-FB-Demi-Bold.woff2`)).status, 200);
 const script = await (await originalFetch(`${origin}/itch-callback.js`)).text();
 assert(script.includes('controller.abort()'));
 assert(script.includes('location.hash.slice(1)'));
 assert(script.includes('history.replaceState'));
});

test('CSRF, role checks and malicious payloads fail with localized safe errors',async()=>{
 let result=await guest.request('/admin/game',{method:'POST',csrf:false,body:{}});assert.equal(result.status,403);
 result=await player.request('/admin/game',{method:'POST',body:{},language:'pt-BR'});assert.equal(result.status,403);assert.equal(result.body.error.locale,'pt-BR');assert.match(result.body.error.message,/permissão/);
 result=await player.request('/support',{method:'POST',rawBody:'{"bad":',language:'es'});assert.equal(result.status,400);assert.equal(result.body.error.code,'INVALID_JSON');assert.equal(result.headers.get('content-language'),'es');
 result=await guest.request('/games/%27%20OR%201=1--');assert.equal(result.status,400);
 const cookie=guest.cookies.get('deadsmile.csrf');assert(cookie.startsWith('s%3A'));guest.cookies.set('deadsmile.csrf','a'.repeat(64));
 result=await guest.request('/support',{method:'POST',body:{},csrf:false});assert.equal(result.status,403);
});
test('cloud saves are encrypted, scoped to the account and checked for concurrent updates',async()=>{
 const payload=Buffer.from(Array(8).fill('0'.repeat(64)).join('\n')).toString('base64');
 let result=await player.request(`/platform/saves/${freeId}/default`,{method:'PUT',body:{filename:'test.p8d.txt',payload}});assert.equal(result.status,200,JSON.stringify(result.body));
 const stored=await pool.query('SELECT payload FROM cloud_saves WHERE user_id=$1',[userId]);assert.match(stored.rows[0].payload,/^enc.v2./);assert.notEqual(stored.rows[0].payload,payload);
 result=await player.request(`/platform/saves/${freeId}/default`);assert.equal(result.body.data.payload,payload);
 result=await other.request(`/platform/saves/${freeId}/default`);assert.equal(result.status,404);
 result=await player.request(`/platform/saves/${freeId}/default`,{method:'PUT',body:{filename:'test.p8d.txt',payload,revision:9}});assert.equal(result.status,409);
 result=await other.request(`/platform/saves/${freeId}/default`,{method:'DELETE'});assert.equal(result.status,404);
});
test('newsletter links a game, sanitizes HTML and uses canonical newswire routes',async()=>{
 const result=await admin.request('/admin/newsletter',{method:'POST',body:{title:'New story',body:'<p onclick="evil()">Story</p><script>evil()</script>',gameId:freeId}});assert.equal(result.status,201,JSON.stringify(result.body));
 const detail=await guest.request(`/newswire/${result.body.data.slug}`);assert.equal(detail.status,200);assert.equal(detail.body.data.game_slug,'free');assert.doesNotMatch(detail.body.data.body,/onclick|script|evil/);
});
test('newsletter Store badge survives creation, persistence, editing and public reads', async () => {
 const badge = '<a href="https://get.microsoft.com/installer/download/9P6P8284V337?referrer=appbadge" target="_self" aria-label="Get it from Microsoft Store"><img src="https://get.microsoft.com/images/en-us%20light.svg" width="200" alt="Get it from Microsoft Store" loading="lazy" onerror="steal()"></a>';
 const result = await admin.request('/admin/newsletter', { method: 'POST', body: { title: 'Store release', body: `<p>Download here</p>${badge}<script>steal()</script>`, gameId: freeId } });
 assert.equal(result.status, 201, JSON.stringify(result.body));
 const news = result.body.data;
 const stored = await pool.query('SELECT body FROM news WHERE id=$1', [news.id]);
 assert.match(stored.rows[0].body, /<img src="https:\/\/get\.microsoft\.com\/images\/en-us%20dark\.svg"/);
 assert.doesNotMatch(stored.rows[0].body, /onerror|script|steal/);
 let detail = await guest.request(`/newswire/${news.slug}`);
 assert.equal(detail.status, 200);
 assert.equal(detail.body.data.body, stored.rows[0].body);
 const update = await admin.request(`/admin/newsletter/${news.id}`, { method: 'PUT', body: { title: 'Store release', body: `<h2>Updated</h2>${badge.replace('en-us%20light.svg', 'pt-br%20dark.svg')}`, gameId: freeId } });
 assert.equal(update.status, 200, JSON.stringify(update.body));
 detail = await guest.request(`/newswire/${news.slug}`);
 assert.equal(detail.status, 200);
 assert.match(detail.body.data.body, /<h2>Updated<\/h2>/);
 assert.match(detail.body.data.body, /pt-br%20dark\.svg/);
 assert.doesNotMatch(detail.body.data.body, /onerror|steal/);
});
test('privacy defaults hide activity and telemetry consent rejects collection',async()=>{
 let result=await player.request('/platform/telemetry',{method:'POST',body:{eventType:'install_failed',gameId:freeId,payload:{code:'GAME_DOWNLOAD_FAILED'}}});assert.equal(result.status,202);assert.equal(result.body.data.accepted,false);
 result=await player.request('/platform/telemetry',{method:'POST',body:{eventType:'install_failed',payload:{password:'secret'}}});assert.equal(result.status,400);
 result=await guest.request('/account/profile/player');assert.equal(result.status,200);assert.deepEqual(result.body.data.recentGames,[]);assert.deepEqual(result.body.data.achievements,[]);assert(!('email' in result.body.data));assert(!('password_hash' in result.body.data));
 result=await player.request('/platform/telemetry-consent',{method:'PATCH',body:{enabled:true}});assert.equal(result.body.data.enabled,true);
 result=await player.request('/platform/telemetry',{method:'POST',body:{eventType:'install_failed',gameId:freeId,payload:{code:'GAME_DOWNLOAD_FAILED'}}});assert.equal(result.body.data.accepted,true);
 await player.request('/platform/telemetry-consent',{method:'PATCH',body:{enabled:false}});assert.equal((await player.request('/platform/telemetry-consent')).body.data.enabled,false);assert.equal((await pool.query('SELECT count(*) FROM telemetry_events WHERE user_id=$1',[userId])).rows[0].count,'0');
 assert.equal((await pool.query('SELECT telemetry_consent,share_game_activity FROM users WHERE id=$1',[userId])).rows[0].telemetry_consent,false);
});
test('changing a free game to paid invalidates old free entitlements',async()=>{
 const added=await player.request(`/library/${freeId}`,{method:'POST'});assert.equal(added.status,200);
 await pool.query("UPDATE games SET access_type='paid',purchase_url='https://studio.itch.io/free/purchase' WHERE id=$1",[freeId]);
 const library=await player.request('/library');assert(!library.body.data.items.some(x=>x.id===freeId));
 const access=await pool.query('SELECT revoked_at FROM user_game_entitlements WHERE user_id=$1 AND game_id=$2',[userId,freeId]);assert(access.rows[0].revoked_at);
});

test('admin game create/edit preserves storefront data and public responses never expose download configuration', async () => {
 const badge='<a href="https://get.microsoft.com/installer/download/9P6P8284V337?referrer=appbadge">\n  <img src="https://get.microsoft.com/images/en-us%20light.svg">\n</a>';
 const body={title:'Admin game',slug:'admin-game',shortDescription:'Created by admin',accessType:'free',status:'released',itchGameId:3000,itchUrl:'https://studio.itch.io/free',downloadUrl:'https://github.com/studio/games/releases/download/v1/game.zip',genres:['Adventure'],platforms:['Windows'],microsoftStoreBadge:badge};
 let result=await admin.request('/admin/game',{method:'POST',body});assert.equal(result.status,201,JSON.stringify(result.body));const id=result.body.data.id;
 assert.equal((await pool.query('SELECT name,public FROM release_channels WHERE game_id=$1',[id])).rows[0].public,true);
 result=await admin.request(`/admin/game/${id}`);assert.equal(result.body.data.downloadUrl,body.downloadUrl);assert.equal(result.body.data.itchUrl,body.itchUrl);assert(result.body.data.microsoftStoreBadgeHtml);
 result=await guest.request('/games/admin-game');assert.equal(result.status,200);assert.equal(result.body.data.downloadUrl,null);assert.equal(result.body.data.accessType,'free');assert.equal(result.body.data.microsoftStoreBadge.productId,'9P6P8284V337');
 result=await player.request(`/admin/game/${id}`);assert.equal(result.status,403);
 result=await admin.request(`/admin/game/${id}`,{method:'PUT',body:{...body,title:'Edited',genres:['Puzzle'],microsoftStoreBadge:badge.replaceAll('\n','\r\n\t')}});assert.equal(result.status,200);
 result=await guest.request('/games/admin-game');assert.deepEqual(result.body.data.genres,['Puzzle']);
 const news=await admin.request('/admin/newsletter',{method:'POST',body:{title:'Linked',body:'Body',gameId:id}});assert.equal(news.status,201);
 result=await admin.request(`/admin/game/${id}`,{method:'DELETE'});assert.equal(result.status,200);
 result=await guest.request(`/newswire/${news.body.data.slug}`);assert.equal(result.status,200);assert.equal(result.body.data.game_id,null);
 const events=await pool.query('SELECT event_type FROM content_events WHERE entity_id=$1 ORDER BY id',[id]);
 assert.deepEqual(events.rows.map((event)=>event.event_type),['game.published','game.updated','game.deleted']);
});

test('editing and deleting news and videos publish public content events', async () => {
 for (const [endpoint, type, initial, change] of [
  ['newsletter','news',{title:'Live news',body:'Original text'},{title:'Live news edited',body:'Updated text'}],
  ['video','video',{title:'Live video',category:'Trailer',videoUrl:'https://youtu.be/abcdefghijk'},{title:'Live video edited',category:'Trailer',videoUrl:'https://youtu.be/abcdefghijk'}],
 ]) {
  const created=await admin.request(`/admin/${endpoint}`,{method:'POST',body:initial});assert.equal(created.status,201);
  const id=created.body.data.id;
  const edited=await admin.request(`/admin/${endpoint}/${id}`,{method:'PUT',body:change});assert.equal(edited.status,200);
  const removed=await admin.request(`/admin/${endpoint}/${id}`,{method:'DELETE'});assert.equal(removed.status,200);
  const events=await pool.query('SELECT event_type FROM content_events WHERE entity_id=$1 ORDER BY id',[id]);
  assert.deepEqual(events.rows.map((event)=>event.event_type),[`${type}.published`,`${type}.updated`,`${type}.deleted`]);
 }
});

test('unverified accounts do not reveal their verification state to a wrong password', async () => {
 await pool.query("INSERT INTO users(email,username,password_hash) VALUES('pending@example.test','pending',$1)",[password]);
 const pending=client();
 let result=await pending.request('/auth/mobile-login',{method:'POST',body:{email:'pending@example.test',password:'WrongPassword123!'}});assert.equal(result.status,401);assert.equal(result.body.error.code,'INVALID_CREDENTIALS');
 result=await pending.request('/auth/mobile-login',{method:'POST',body:{email:'pending@example.test',password:'TestPassword123!'}});assert.equal(result.status,403);assert.equal(result.body.error.code,'EMAIL_NOT_VERIFIED');
});

test('protected saves reject ciphertext tampering and another account scope', async () => {
 const {encryptSecret,decryptSecret}=await import('../src/utils/secretCipher.js');
 const encrypted=encryptSecret('save-data',`save:${userId}:${freeId}:default`);
 assert.equal(decryptSecret(encrypted,`save:${userId}:${freeId}:default`),'save-data');
 assert.throws(()=>decryptSecret(encrypted,`save:${otherId}:${freeId}:default`),{code:'SECRET_DECRYPT_FAILED'});
 const parts=encrypted.split('.');parts[3]=Buffer.alloc(16).toString('base64url');
 assert.throws(()=>decryptSecret(parts.join('.'),`save:${userId}:${freeId}:default`),{code:'SECRET_DECRYPT_FAILED'});
});

test('Store outages return labelled stale metadata and never create a launcher download link', async () => {
 await pool.query("UPDATE microsoft_store_products SET fetched_at=now()-interval '2 hours'");
 storeOffline = true;
 const page = await guest.request('/launcher', { language: 'pt-BR' });
 assert.equal(page.status, 200); assert.equal(page.body.data.stale, true);
 const install = await player.request(`/library/${msId}/install-metadata`, { method: 'POST', language: 'pt-BR' });
 assert.equal(install.status, 409); assert.equal(install.body.error.code, 'GAME_RELEASE_NOT_CONFIGURED');
 assert.match(install.body.error.message, /download/);
 await pool.query("UPDATE microsoft_store_products SET fetched_at=now()-interval '8 days'");
 const expired = await guest.request('/launcher', { language: 'pt-BR' });
 assert.equal(expired.status, 502); assert(!JSON.stringify(expired.body).includes('provider unavailable'));
 storeOffline = false;
});


test('free website download registers library membership and disconnecting itch preserves it', async () => {
 await pool.query("DELETE FROM api_rate_limits WHERE scope='integration'");
 await pool.query('UPDATE games SET download_url=$2 WHERE id=$1', [msId, 'https://downloads.example.test/free.zip']);
 try {
  const response = await player.request('/games/store/download');
  assert.equal(response.status, 200); assert.equal(response.body.data.downloadUrl, 'https://downloads.example.test/free.zip');
  const free = (await player.request('/library')).body.data.items.find((game) => game.id === msId);
  assert.equal(free.isFree, true); assert.equal(free.accessType, 'free'); assert.equal(free.inLibrary, true);
  assert.equal((await player.request('/library/sync', { method: 'POST' })).status, 200);
  assert.equal((await player.request(`/library/${paidId}`, { method: 'POST' })).status, 200);
  assert((await player.request('/library')).body.data.items.some((game) => game.id === paidId));
  const disconnected = await player.request('/integrations/itch', { method: 'DELETE' }); assert.equal(disconnected.status, 200);
  assert.equal((await pool.query('SELECT user_id FROM user_itch_accounts WHERE user_id=$1', [userId])).rows.length, 0);
  const catalog = (await player.request('/library/catalog')).body.data.items;
  assert.equal(catalog.find((game) => game.id === paidId).owned, false);
  assert.equal(catalog.find((game) => game.id === paidId).inLibrary, false);
  const library = (await player.request('/library')).body.data.items;
  assert(!library.some((game) => game.id === paidId)); assert(library.some((game) => game.id === msId));
  assert((await other.request('/library')).body.data.items.some((game) => game.id === msId));
 } finally { await pool.query('UPDATE games SET download_url=null WHERE id=$1', [msId]); }
});
