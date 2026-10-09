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
process.env.ITCH_DOWNLOAD_API_KEY='test-provider-token';
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

test('Microsoft installation checks current full-product price instead of trusting the free flag or a free trial', async () => {
 storePaid = true;
 try {
  const install = await player.request(`/library/${msId}/install-metadata`, { method: 'POST', language: 'pt-BR' });
  assert.equal(install.status, 409); assert.equal(install.body.error.code, 'MICROSOFT_GAME_NOT_FREE');
  assert.match(install.body.error.message, /gratuito/);
 } finally { storePaid = false; }
 const install = await player.request(`/library/${msId}/install-metadata`, { method: 'POST', language: 'pt-BR' });
 assert.equal(install.status, 200);
});

test('free game is acquired without itch account and downloaded from the provider',async()=>{
 const result=await player.request(`/library/${freeId}/verify`,{method:'POST'});assert.equal(result.status,200);assert.equal(result.body.data.owned,true);
 const install=await player.request(`/library/${freeId}/install-metadata`,{method:'POST'});assert.equal(install.status,200);assert.equal(install.body.data.downloadUrl,'https://uploads.itch.zone/free-v100.zip');
 const library=await player.request('/library');assert.equal(library.body.data.items[0].isFree,true);
});
test('Microsoft-only free game delegates to the official installer',async()=>{
 const result=await player.request(`/library/${msId}/install-metadata`,{method:'POST'});assert.equal(result.status,200);assert.equal(result.body.data.delivery,'microsoft-store');assert.match(result.body.data.storeUrl,/get.microsoft.com/);
});
test('paid ownership checks all pages, including short pages, and revokes removed ownership',async()=>{
 let result=await player.request(`/library/${paidId}/verify`,{method:'POST'});assert.equal(result.status,409);assert.equal(result.body.error.code,'ITCH_NOT_CONNECTED');
 await pool.query('INSERT INTO user_itch_accounts(user_id,itch_user_id,itch_username,access_token_encrypted) VALUES($1,1234,\'test\',$2)',[userId,encryptToken('test-token')]);
 result=await player.request(`/library/${paidId}/verify`,{method:'POST'});assert.equal(result.status,200);assert.equal(result.body.data.owned,true);assert(calls.some(x=>x.includes('page=3')));
 revoked=true;result=await player.request('/platform/sessions',{method:'POST',body:{gameId:paidId,platform:'windows'}});assert.equal(result.status,403);assert.equal(result.body.error.code,'GAME_ACCESS_REQUIRED');
 const library=await player.request('/library');assert(!library.body.data.items.some(x=>x.id===paidId));revoked=false;
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
 assert.match(stored.rows[0].body, /<img src="https:\/\/get\.microsoft\.com\/images\/en-us%20light\.svg"/);
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

test('Store outages return labelled stale metadata but never authorize Microsoft installation using stale pricing', async () => {
 await pool.query("UPDATE microsoft_store_products SET fetched_at=now()-interval '2 hours'");
 storeOffline = true;
 const page = await guest.request('/launcher', { language: 'pt-BR' });
 assert.equal(page.status, 200); assert.equal(page.body.data.stale, true);
 const install = await player.request(`/library/${msId}/install-metadata`, { method: 'POST', language: 'pt-BR' });
 assert.equal(install.status, 502); assert.equal(install.body.error.code, 'MICROSOFT_STORE_UNAVAILABLE');
 assert.match(install.body.error.message, /temporariamente/);
 await pool.query("UPDATE microsoft_store_products SET fetched_at=now()-interval '8 days'");
 const expired = await guest.request('/launcher', { language: 'pt-BR' });
 assert.equal(expired.status, 502); assert(!JSON.stringify(expired.body).includes('provider unavailable'));
 storeOffline = false;
});
