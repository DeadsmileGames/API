import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const originalFetch = globalThis.fetch;
let revoked = false;
let ownedKeysOverride = null;
let calls = [];
let storePaid = false;
let storeOffline = false;
const storeEdge = JSON.parse(
  await readFile(new URL("./fixtures/store-edge.json", import.meta.url), "utf8"),
);
const storeCatalog = JSON.parse(
  await readFile(new URL("./fixtures/store-catalog.json", import.meta.url), "utf8"),
);
const db = await PGlite.create({ extensions: { pg_trgm } });
await db.exec(await readFile(new URL("../src/database/schema.sql", import.meta.url), "utf8"));
const socket = new PGLiteSocketServer({
  db,
  port: 0,
  host: "127.0.0.1",
  maxConnections: 20,
});
await socket.start();
process.env.DATABASE_URL = `postgres://postgres:postgres@${socket.getServerConn()}/postgres`;
process.env.SESSION_SECRET = "isolated-test-session-key-".repeat(2);
process.env.DATA_ENCRYPTION_KEY = "isolated-test-data-key-".repeat(2);
process.env.ITCH_CLIENT_ID = "test-client";
process.env.ITCH_TOKEN_ENCRYPTION_KEY = "isolated-test-itch-key-".repeat(2);
process.env.ITCH_REDIRECT_URI = "https://api.example.test/callback";
process.env.VERCEL = "1";
process.env.BREVO_API_KEY = "integration-test-brevo-key";
process.env.RECAPTCHA_SECRET_KEY = "integration-test-recaptcha-secret";
process.env.BREVO_SENDER_EMAIL = "noreply@example.test";
const { pool } = await import("../src/config/database.js");
const { hashPassword } = await import("../src/utils/password.js");
const { encryptToken } = await import("../src/utils/tokenCipher.js");
const { createApp, default: unusedServer } = await import("../src/app.js");
const app = createApp();
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}/api`;
globalThis.fetch = async (input, options) => {
  const url = String(input);
  if (url.startsWith(base)) return originalFetch(input, options);
  if (url.startsWith("https://api.brevo.com/")) return Response.json({ messageId: "preorder-email-test" });
  if (url === "https://www.google.com/recaptcha/api/siteverify") return Response.json({ success: true, hostname: "api.example.test" });
  calls.push(url);
  if (/^https:\/\/(?:storeedgefd\.dsx|displaycatalog)\.mp\.microsoft\.com\//.test(url)) {
    if (storeOffline) throw new Error("provider unavailable");
    const value = structuredClone(url.includes("storeedgefd") ? storeEdge : storeCatalog);
    if (storePaid) {
      if (value.Payload) value.Payload.Skus[0].Availabilities[0].Price = 5;
      if (value.Product)
        value.Product.DisplaySkuAvailabilities[0].Availabilities[0].OrderManagementData.Price.ListPrice = 5;
    }
    return Response.json(value);
  }
  if (url === "https://api.itch.io/credentials/info")
    return Response.json({ scopes: ["profile:me", "profile:owned"] });
  if (url === "https://api.itch.io/profile")
    return Response.json({
      user: {
        id: 9876543210,
        username: "oauth-bound-test",
        url: "https://oauth-bound-test.itch.io",
      },
    });
  if (url.includes("/profile/owned-keys")) {
    const page = Number(new URL(url).searchParams.get("page") || 1);
    if (ownedKeysOverride) return Response.json(ownedKeysOverride(page));
    return Response.json({
      per_page: 50,
      owned_keys: revoked || page > 2 ? [] : [{ id: 800 + page, game_id: page === 1 ? 999 : 1000 }],
    });
  }
  if (url.endsWith("/data.json"))
    return Response.json({
      id: url.includes("/paid/") ? 1000 : 2000,
      price: url.includes("/paid/") ? "$4.99" : "$0.00",
    });
  if (url.endsWith("/profile/games"))
    return Response.json({ games: [{ id: 2000, min_price: 0, published: true }] });
  if (url.endsWith("/games/2000/uploads"))
    return Response.json({
      uploads: [
        { id: 700, filename: "free-v100.zip", p_windows: true, size: 100, min_price: 0 },
        {
          id: 701,
          filename: "paid-extra.zip",
          p_windows: true,
          size: 100,
          min_price: 1000,
        },
      ],
    });
  if (url.endsWith("/uploads/700/download"))
    return Response.json({ url: "https://uploads.itch.zone/free-v100.zip" });
  throw new Error("Unmocked external request");
};
const userId = "00000000-0000-4000-8000-000000000001";
const otherId = "00000000-0000-4000-8000-000000000002";
const adminId = "00000000-0000-4000-8000-000000000003";
const freeId = "00000000-0000-4000-8000-000000000004";
const paidId = "00000000-0000-4000-8000-000000000005";
const msId = "00000000-0000-4000-8000-000000000006";
const password = await hashPassword("TestPassword123!");
for (const [id, username, role] of [
  [userId, "player", "user"],
  [otherId, "other", "user"],
  [adminId, "admin", "admin"],
])
  await pool.query(
    "INSERT INTO users(id,email,username,password_hash,role,email_verified_at) VALUES($1,$2,$3,$4,$5,now())",
    [id, `${username}@example.test`, username, password, role],
  );
await pool.query(
  `INSERT INTO games(id,title,slug,short_description,status,access_type,itch_game_id,itch_url,cloud_saves_enabled) VALUES($1,'Free','free','free','released','free',2000,'https://studio.itch.io/free',true)`,
  [freeId],
);
await pool.query(
  `INSERT INTO games(id,title,slug,short_description,status,access_type,itch_game_id,purchase_url) VALUES($1,'Paid','paid','paid','released','paid',1000,'https://studio.itch.io/paid/purchase')`,
  [paidId],
);
await pool.query(
  `INSERT INTO games(id,title,slug,short_description,status,access_type,microsoft_product_id,microsoft_badge_image) VALUES($1,'Store','store','store','released','free','9P6P8284V337','https://get.microsoft.com/images/en-us%20light.svg')`,
  [msId],
);
function client() {
  const cookies = new Map();
  let token;
  return {
    cookies,
    async request(path, {
      method = "GET",
      body,
      csrf = true,
      language = "en",
      rawBody,
      forwardedFor,
      origin,
      retryCsrf = true,
    } = {}) {
      if (method !== "GET" && csrf && !token) {
        const result = await this.request("/csrf");
        token = result.body.data.token;
      }
      if (path === "/auth/login" && body && typeof body === "object" && !("recaptchaToken" in body)) {
        body = { ...body, recaptchaToken: "integration-test-recaptcha-token" };
      }
      const response = await fetch(base + path, {
        method,
        headers: {
          Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
          "Accept-Language": language,
          ...(forwardedFor ? { "X-Vercel-Forwarded-For": forwardedFor } : {}),
          ...(origin ? { Origin: origin } : {}),
          ...(body !== undefined || rawBody ? { "Content-Type": "application/json" } : {}),
          ...(method !== "GET" && csrf ? { "X-CSRF-Token": token } : {}),
        },
        body: rawBody || (body !== undefined ? JSON.stringify(body) : undefined),
      });
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(";")[0];
        const i = pair.indexOf("=");
        cookies.set(pair.slice(0, i), pair.slice(i + 1));
      }
      const responseBody = await response.json();
      if (path === "/csrf" && response.ok && responseBody?.success === true && typeof responseBody?.data?.token === "string") {
        token = responseBody.data.token;
      }
      if (
        method !== "GET" &&
        csrf &&
        retryCsrf &&
        response.status === 403 &&
        responseBody?.error?.code === "CSRF_VALIDATION_FAILED"
      ) {
        await this.request("/csrf");
        return this.request(path, {
          method,
          body,
          csrf,
          language,
          rawBody,
          forwardedFor,
          origin,
          retryCsrf: false,
        });
      }
      return {
        status: response.status,
        body: responseBody,
        headers: response.headers,
      };
    },
    async login(username) {
      const result = await this.request("/auth/login", {
        method: "POST",
        body: { email: `${username}@example.test`, password: "TestPassword123!", recaptchaToken: "integration-test-recaptcha-token" },
      });
      assert.equal(result.status, 200, JSON.stringify(result.body));
    },
  };
}
const player = client(),
  other = client(),
  admin = client(),
  guest = client();
await player.login("player");
await other.login("other");
await admin.login("admin");

test("Windows launcher login uses an HttpOnly server session cookie", async () => {
  const launcher = client();
  const result = await launcher.request("/auth/launcher-login", {
    method: "POST",
    body: { email: "player@example.test", password: "TestPassword123!" },
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.ok(
    result.headers.getSetCookie().some((cookie) => /deadsmile\.sid=.*httponly/i.test(cookie)),
    "launcher session cookie must be HttpOnly",
  );
  const me = await launcher.request("/auth/me");
  assert.equal(me.status, 200, JSON.stringify(me.body));
});
test("itch OAuth flow reveals only the allowed frontend redirect and keeps state account-bound", async () => {
  const { createHash, randomBytes } = await import("node:crypto");
  const { createOAuthState } = await import("../src/repositories/itch-integration.repository.js");
  const state = randomBytes(48).toString("base64url");
  const stateHash = createHash("sha256").update(state).digest("hex");
  await createOAuthState({
    stateHash,
    userId,
    client: "site",
    locale: "en",
    returnPath: "/account#games",
    frontendOrigin: "https://deadsmilegames.onrender.com",
    expiresAt: new Date(Date.now() + 60_000),
  });

  const resolved = await player.request("/integrations/itch/flow", {
    method: "POST",
    body: { state },
  });
  assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
  assert.deepEqual(resolved.body.data, {
    client: "site",
    frontendOrigin: "https://deadsmilegames.onrender.com",
  });

  const wrongAccount = await other.request("/integrations/itch/complete", {
    method: "POST",
    body: { state, accessToken: "a-test-access-token-value-long-enough" },
  });
  assert.equal(wrongAccount.status, 400);
  assert.equal(wrongAccount.body.error.code, "ITCH_LINK_EXPIRED");
  const row = await pool.query(
    "SELECT consumed_at FROM itch_oauth_states WHERE state_hash=$1",
    [stateHash],
  );
  assert.equal(row.rows[0].consumed_at, null);

  const blockedLauncherFlow = await player.request("/integrations/itch/connect", {
    method: "POST",
    body: { client: "launcher", locale: "en" },
  });
  assert.equal(blockedLauncherFlow.status, 400);
  assert.equal(blockedLauncherFlow.body.error.code, "ITCH_LINK_EXPIRED");
});

test("itch OAuth initiation rejects untrusted origins and binds valid flows to the requested frontend", async () => {
  const { createHash } = await import("node:crypto");
  const payload = {
    client: "site",
    locale: "en",
    returnPath: "/account#games",
  };
  const rejected = await player.request("/integrations/itch/connect", {
    method: "POST",
    body: payload,
    origin: "https://evil.example",
  });
  assert.equal(rejected.status, 403);

  const created = await player.request("/integrations/itch/connect", {
    method: "POST",
    body: payload,
    origin: "https://deadsmilegames.onrender.com",
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const authorizeUrl = new URL(created.body.data.authorizeUrl);
  const state = authorizeUrl.searchParams.get("state");
  assert.equal(authorizeUrl.origin, "https://itch.io");
  assert.equal(authorizeUrl.pathname, "/user/oauth");
  assert.equal(authorizeUrl.searchParams.get("response_type"), "token");
  assert(state);

  const resolved = await player.request("/integrations/itch/flow", {
    method: "POST",
    body: { state },
  });
  assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
  assert.deepEqual(resolved.body.data, {
    client: "site",
    frontendOrigin: "https://deadsmilegames.onrender.com",
  });

  const unauthenticated = await guest.request("/integrations/itch/complete", {
    method: "POST",
    body: { state, accessToken: "oauth-test-token-value-long-enough" },
  });
  assert.equal(unauthenticated.status, 401);

  const wrongAccount = await other.request("/integrations/itch/complete", {
    method: "POST",
    body: { state, accessToken: "oauth-test-token-value-long-enough" },
  });
  assert.equal(wrongAccount.status, 400);
  assert.equal(wrongAccount.body.error.code, "ITCH_LINK_EXPIRED");

  const previousRevoked = revoked;
  const previousOwnedKeysOverride = ownedKeysOverride;
  revoked = false;
  ownedKeysOverride = () => ({ per_page: 50, owned_keys: [] });
  try {
    const completed = await player.request("/integrations/itch/complete", {
      method: "POST",
      body: { state, accessToken: "oauth-test-token-value-long-enough" },
    });
    assert.equal(completed.status, 200, JSON.stringify(completed.body));
    assert.equal(completed.body.data.client, "site");
    assert.equal(completed.body.data.returnUrl, "https://deadsmilegames.onrender.com/account#games");
    const storedState = await pool.query(
      "SELECT consumed_at, frontend_origin FROM itch_oauth_states WHERE state_hash=$1",
      [createHash("sha256").update(state).digest("hex")],
    );
    assert(storedState.rows[0].consumed_at);
    assert.equal(storedState.rows[0].frontend_origin, "https://deadsmilegames.onrender.com");

    const replay = await player.request("/integrations/itch/complete", {
      method: "POST",
      body: { state, accessToken: "oauth-test-token-value-long-enough" },
    });
    assert.equal(replay.status, 400);
    assert.equal(replay.body.error.code, "ITCH_LINK_EXPIRED");
  } finally {
    revoked = previousRevoked;
    ownedKeysOverride = previousOwnedKeysOverride;
  }
});


test.after(async () => {
  globalThis.fetch = originalFetch;
  await new Promise((r) => server.close(r));
  unusedServer.close();
  await pool.end();
  await socket.stop();
  await db.close();
});

test("catalog exposes paid games without granting ownership and free additions are explicit and scoped", async () => {
  const initial = await other.request("/library/catalog");
  assert.equal(initial.status, 200);
  assert.equal(initial.headers.get("cache-control"), "no-store");
  const paid = initial.body.data.items.find((game) => game.id === paidId);
  assert.equal(paid.accessType, "paid");
  assert.equal(paid.owned, false);
  assert.equal(paid.inLibrary, false);
  const free = initial.body.data.items.find((game) => game.id === msId);
  assert.equal(free.accessType, "free");
  assert.equal(free.owned, true);
  assert.equal(free.inLibrary, false);
  assert.equal((await guest.request("/library/catalog")).status, 401);
  assert.equal((await guest.request(`/library/${msId}`, { method: "POST" })).status, 401);
  const count = calls.length;
  for (let index = 0; index < 2; index++) {
    const added = await other.request(`/library/${msId}`, {
      method: "POST",
      body: { userId, owned: true },
    });
    assert.equal(added.status, 200);
    assert.equal(added.body.data.inLibrary, true);
  }
  assert.equal(calls.length, count);
  const rows = await pool.query(
    "SELECT user_id,source,revoked_at FROM user_game_entitlements WHERE game_id=$1",
    [msId],
  );
  assert.equal(rows.rows.length, 1);
  assert.equal(rows.rows[0].user_id, otherId);
  assert.equal(rows.rows[0].source, "free");
  assert.equal(rows.rows[0].revoked_at, null);
  assert((await other.request("/library")).body.data.items.some((game) => game.id === msId));
  assert(!(await player.request("/library")).body.data.items.some((game) => game.id === msId));
  const forged = await other.request(`/library/${paidId}`, {
    method: "POST",
    body: { userId, owned: true, accessType: "free" },
  });
  assert.equal(forged.status, 409);
  assert.equal(forged.body.error.code, "ITCH_NOT_CONNECTED");
  assert(!(await other.request("/library")).body.data.items.some((game) => game.id === paidId));
});

test("launcher metadata uses locale-specific persistent caching and game details share the Store model", async () => {
  const first = await guest.request("/launcher", { language: "pt-BR" });
  assert.equal(first.status, 200);
  assert.equal(first.body.data.locale, "pt-BR");
  assert.equal(first.body.data.market, "BR");
  assert.equal(first.body.data.version, "1.0.0.0");
  assert.equal(first.body.data.primaryRating.id, "DJCTQ:14");
  assert.equal(first.body.data.downloadCount, null);
  assert.equal(first.headers.get("content-language"), "pt-BR");
  const count = calls.length;
  const second = await guest.request("/launcher", { language: "pt-BR" });
  assert.equal(second.status, 200);
  assert.equal(calls.length, count);
  const detail = await guest.request("/games/store", { language: "pt-BR" });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.microsoftStore.productId, "9P6P8284V337");
  assert(!JSON.stringify(detail.body).includes("PackageUri"));
});

test("launcher refuses Store or itch-only installation without the game database download link", async () => {
  for (const id of [freeId, msId]) {
    const install = await player.request(`/library/${id}/install-metadata`, {
      method: "POST",
      language: "pt-BR",
    });
    assert.equal(install.status, 409);
    assert.equal(install.body.error.code, "GAME_RELEASE_NOT_CONFIGURED");
  }
  const result = await player.request(`/library/${freeId}/verify`, { method: "POST" });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.owned, true);
  const library = await player.request("/library");
  assert(!library.body.data.items.some((item) => item.id === freeId));
  assert(!library.body.data.items.some((item) => item.id === msId));
  assert(library.body.data.items.every((item) => item.downloadUrl === null));
});

test("paid ownership checks short pages until verified and revokes removed ownership", async () => {
  let result = await player.request(`/library/${paidId}/verify`, { method: "POST" });
  assert.equal(result.status, 409);
  assert.equal(result.body.error.code, "ITCH_NOT_CONNECTED");
  await pool.query(
    "INSERT INTO user_itch_accounts(user_id,itch_user_id,itch_username,access_token_encrypted) VALUES($1,1234,'test',$2)",
    [userId, encryptToken("test-token")],
  );
  result = await player.request(`/library/${paidId}/verify`, { method: "POST" });
  assert.equal(result.status, 200);
  assert.equal(result.body.data.owned, true);
  assert(calls.some((x) => x.includes("page=2")));
  assert(!calls.some((x) => x.includes("page=3")));
  revoked = true;
  result = await player.request("/platform/sessions", {
    method: "POST",
    body: { gameId: paidId, platform: "windows" },
  });
  assert.equal(result.status, 403);
  assert.equal(result.body.error.code, "GAME_ACCESS_REQUIRED");
  const library = await player.request("/library");
  assert(!library.body.data.items.some((x) => x.id === paidId));
  revoked = false;
});

test("itch library accepts a confirmed empty terminal object and rejects malformed pages without revoking existing access", async () => {
  await pool.query("DELETE FROM api_rate_limits WHERE scope='integration'");
  const { syncItchLibrary } = await import("../src/services/itch-integration.service.js");
  try {
    ownedKeysOverride = (page) => ({
      page,
      owned_keys: page === 1 ? [{ id: 810, game_id: 1000 }] : {},
    });
    const result = await syncItchLibrary(userId);
    assert.equal(result.results.find((game) => game.gameId === paidId)?.owned, true);
    for (const invalid of [null, "invalid", { key: { game_id: 1000 } }, {}, undefined]) {
      ownedKeysOverride = (page) =>
        page === 1
          ? { page, owned_keys: [{ id: 810, game_id: 1000 }] }
          : { page: 999, owned_keys: invalid };
      await assert.rejects(
        syncItchLibrary(userId),
        (error) => error.code === "ITCH_LIBRARY_INVALID",
      );
      const entitlement = await pool.query(
        "SELECT revoked_at FROM user_game_entitlements WHERE user_id=$1 AND game_id=$2",
        [userId, paidId],
      );
      assert.equal(entitlement.rows[0].revoked_at, null);
    }
  } finally {
    ownedKeysOverride = null;
  }
});

test("website downloads use the database link for free games and recheck paid ownership on itch.io", async () => {
  await pool.query("UPDATE games SET download_url=$2 WHERE id=ANY($1::uuid[])", [
    [freeId, paidId],
    "https://downloads.example.test/game.zip",
  ]);
  try {
    const free = await guest.request("/games/free/download");
    assert.equal(free.status, 200);
    assert.equal(free.body.data.downloadUrl, "https://downloads.example.test/game.zip");
    assert.equal(free.headers.get("cache-control"), "no-store");
    const publicPaid = await guest.request("/games/paid");
    assert.equal(publicPaid.body.data.downloadUrl, null);
    assert.equal(publicPaid.body.data.downloadAvailable, true);
    assert.equal((await guest.request("/games/paid/download")).status, 401);
    assert.equal(
      (await other.request("/games/paid/download")).body.error.code,
      "ITCH_NOT_CONNECTED",
    );
    assert.equal((await player.request("/games/paid/download")).status, 200);
    revoked = true;
    const denied = await player.request("/games/paid/download", { language: "pt-BR" });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.error.code, "GAME_NOT_OWNED");
    assert.equal(denied.body.error.locale, "pt-BR");
  } finally {
    revoked = false;
    await pool.query("UPDATE games SET download_url=null WHERE id=ANY($1::uuid[])", [
      [freeId, paidId],
    ]);
  }
});

test("game validation identifies the rejected field in each locale without echoing its value", async () => {
  const payload = {
    title: "Invalid game",
    slug: "Invalid Slug",
    shortDescription: "Game",
    accessType: "free",
    heroImage: "javascript:PRIVATE_SENTINEL",
  };
  for (const language of ["en", "pt-BR", "es"]) {
    const response = await admin.request("/admin/game", {
      method: "POST",
      language,
      body: payload,
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.error.locale, language);
    assert.deepEqual(
      response.body.error.fields.map((item) => item.field),
      ["slug", "heroImage"],
    );
    assert(response.body.error.fields.every((item) => item.message));
    assert(!JSON.stringify(response.body).includes("PRIVATE_SENTINEL"));
  }
});

test("newswire returns the persisted original in every interface language", async () => {
  const created = await admin.request("/admin/newsletter", {
    method: "POST",
    body: { title: "English original", body: "<p>English story.</p>" },
  });
  for (const language of ["en", "pt-BR", "es"]) {
    const original = await guest.request(`/newswire/${created.body.data.slug}`, {
      language,
    });
    assert.equal(original.body.data.title, "English original");
    assert.equal(original.body.data.body, "<p>English story.</p>");
    assert.equal(Object.hasOwn(original.body.data, "translation"), false);
  }
  assert.equal(
    (await pool.query("SELECT body FROM news WHERE id=$1", [created.body.data.id])).rows[0].body,
    "<p>English story.</p>",
  );
});
test("itch callback reuses website CSS and ships bounded accessible connection states", async () => {
  const origin = new URL(base).origin;
  const response = await originalFetch(`${base}/integrations/itch/callback`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const html = await response.text();
  assert(html.includes('href="/styles/global.css"'));
  assert(html.includes("newsletter-action__card"));
  assert(html.includes('aria-busy="true"'));
  assert(!html.includes("callback-card"));
  assert.equal(
    await (await originalFetch(`${origin}/styles/global.css`)).text(),
    await readFile(new URL("../public/styles/global.css", import.meta.url), "utf8"),
  );
  assert.equal((await originalFetch(`${origin}/fonts/Berlin-Sans-FB-Demi-Bold.woff2`)).status, 200);
  const script = await (await originalFetch(`${origin}/itch-callback.js`)).text();
  assert(script.includes("controller.abort()"));
  assert(script.includes("location.hash.slice(1)"));
  assert(script.includes("history.replaceState"));
});

test("CSRF, role checks and malicious payloads fail with localized safe errors", async () => {
  let result = await guest.request("/admin/game", {
    method: "POST",
    csrf: false,
    body: {},
  });
  assert.equal(result.status, 403);
  result = await player.request("/admin/game", {
    method: "POST",
    body: {},
    language: "pt-BR",
  });
  assert.equal(result.status, 403);
  assert.equal(result.body.error.locale, "pt-BR");
  assert.match(result.body.error.message, /permissão/);
  result = await player.request("/support", {
    method: "POST",
    rawBody: '{"bad":',
    language: "es",
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "INVALID_JSON");
  assert.equal(result.headers.get("content-language"), "es");
  result = await guest.request("/games/%27%20OR%201=1--");
  assert.equal(result.status, 400);
  const cookie = guest.cookies.get("deadsmile.csrf");
  assert(cookie.startsWith("s%3A"));
  guest.cookies.set("deadsmile.csrf", "a".repeat(64));
  result = await guest.request("/support", { method: "POST", body: {}, csrf: false });
  assert.equal(result.status, 403);
});
test("cloud saves are encrypted, scoped to the account and checked for concurrent updates", async () => {
  const payload = Buffer.from(Array(8).fill("0".repeat(64)).join("\n")).toString("base64");
  let result = await player.request(`/platform/saves/${freeId}/default`, {
    method: "PUT",
    body: { filename: "test.p8d.txt", payload },
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  const stored = await pool.query("SELECT payload FROM cloud_saves WHERE user_id=$1", [userId]);
  assert.match(stored.rows[0].payload, /^enc.v2./);
  assert.notEqual(stored.rows[0].payload, payload);
  result = await player.request(`/platform/saves/${freeId}/default`);
  assert.equal(result.body.data.payload, payload);
  result = await other.request(`/platform/saves/${freeId}/default`);
  assert.equal(result.status, 404);
  result = await player.request(`/platform/saves/${freeId}/default`, {
    method: "PUT",
    body: { filename: "test.p8d.txt", payload, revision: 9 },
  });
  assert.equal(result.status, 409);
  result = await other.request(`/platform/saves/${freeId}/default`, { method: "DELETE" });
  assert.equal(result.status, 404);
});
test("newsletter links a game, sanitizes HTML and uses canonical newswire routes", async () => {
  const result = await admin.request("/admin/newsletter", {
    method: "POST",
    body: {
      title: "New story",
      body: '<p onclick="evil()">Story</p><script>evil()</script>',
      gameId: freeId,
    },
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  const detail = await guest.request(`/newswire/${result.body.data.slug}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.game_slug, "free");
  assert.doesNotMatch(detail.body.data.body, /onclick|script|evil/);
});
test("newsletter Store badge survives creation, persistence, editing and public reads", async () => {
  const badge =
    '<a href="https://get.microsoft.com/installer/download/9P6P8284V337?referrer=appbadge" target="_self" aria-label="Get it from Microsoft Store"><img src="https://get.microsoft.com/images/en-us%20light.svg" width="200" alt="Get it from Microsoft Store" loading="lazy" onerror="steal()"></a>';
  const result = await admin.request("/admin/newsletter", {
    method: "POST",
    body: {
      title: "Store release",
      body: `<p>Download here</p>${badge}<script>steal()</script>`,
      gameId: freeId,
    },
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  const news = result.body.data;
  const stored = await pool.query("SELECT body FROM news WHERE id=$1", [news.id]);
  assert.match(
    stored.rows[0].body,
    /<img src="https:\/\/get\.microsoft\.com\/images\/en-us%20dark\.svg"/,
  );
  assert.doesNotMatch(stored.rows[0].body, /onerror|script|steal/);
  let detail = await guest.request(`/newswire/${news.slug}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.body, stored.rows[0].body);
  const update = await admin.request(`/admin/newsletter/${news.id}`, {
    method: "PUT",
    body: {
      title: "Store release",
      body: `<h2>Updated</h2>${badge.replace("en-us%20light.svg", "pt-br%20dark.svg")}`,
      gameId: freeId,
    },
  });
  assert.equal(update.status, 200, JSON.stringify(update.body));
  detail = await guest.request(`/newswire/${news.slug}`);
  assert.equal(detail.status, 200);
  assert.match(detail.body.data.body, /<h2>Updated<\/h2>/);
  assert.match(detail.body.data.body, /pt-br%20dark\.svg/);
  assert.doesNotMatch(detail.body.data.body, /onerror|steal/);
});
test("server time endpoint returns authoritative time formatted for the visitor time zone", async () => {
  const result = await guest.request("/time?timeZone=America%2FNew_York");
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.timeZone, "America/New_York");
  assert.equal(Number.isFinite(result.body.data.epochMs), true);
  assert.equal(Number.isNaN(Date.parse(result.body.data.utc)), false);
  assert.equal(typeof result.body.data.localTime, "string");
  const fallback = await guest.request("/time?timeZone=not-a-real-zone");
  assert.equal(fallback.body.data.timeZone, "UTC");
});

test("only the reserved Deadsmile and luxjson accounts can configure verified public profile banners", async () => {
  await pool.query("UPDATE users SET username='deadsmilegames', profile_banner_url=NULL WHERE id=$1", [adminId]);
  try {
    const officialRename = await admin.request("/account", {
      method: "PATCH",
      body: { username: "deadsmilegames_renamed" },
    });
    assert.equal(officialRename.status, 409, JSON.stringify(officialRename.body));

    const claimedOfficialName = await player.request("/account", {
      method: "PATCH",
      body: { username: "deadsmilegames" },
    });
    assert.equal(claimedOfficialName.status, 409, JSON.stringify(claimedOfficialName.body));

    const saved = await admin.request("/account", {
      method: "PATCH",
      body: { profileBannerUrl: "https://images.example.test/deadsmile-banner.webp" },
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.data.profileBannerUrl, "https://images.example.test/deadsmile-banner.webp");
    assert.equal(saved.body.data.isVerified, true);

    const publicOfficial = await guest.request("/account/profile/deadsmilegames");
    assert.equal(publicOfficial.status, 200, JSON.stringify(publicOfficial.body));
    assert.equal(publicOfficial.body.data.bannerUrl, "https://images.example.test/deadsmile-banner.webp");
    assert.equal(publicOfficial.body.data.isVerified, true);

    const attemptedImpersonation = await player.request("/account", {
      method: "PATCH",
      body: { profileBannerUrl: "https://images.example.test/fake-banner.webp" },
    });
    assert.equal(attemptedImpersonation.status, 200, JSON.stringify(attemptedImpersonation.body));
    assert.equal(attemptedImpersonation.body.data.profileBannerUrl, null);
    const publicPlayer = await guest.request("/account/profile/player");
    assert.equal(publicPlayer.body.data.bannerUrl, null);
    assert.equal(publicPlayer.body.data.isVerified, false);

    await pool.query("UPDATE users SET username='luxjson', profile_banner_url=NULL WHERE id=$1", [otherId]);
    const luxjsonRename = await other.request("/account", {
      method: "PATCH",
      body: { username: "luxjson_changed" },
    });
    assert.equal(luxjsonRename.status, 409, JSON.stringify(luxjsonRename.body));

    const claimedLuxjsonName = await player.request("/account", {
      method: "PATCH",
      body: { username: "luxjson" },
    });
    assert.equal(claimedLuxjsonName.status, 409, JSON.stringify(claimedLuxjsonName.body));

    const luxjsonSaved = await other.request("/account", {
      method: "PATCH",
      body: { profileBannerUrl: "https://images.example.test/luxjson-banner.webp" },
    });
    assert.equal(luxjsonSaved.status, 200, JSON.stringify(luxjsonSaved.body));
    assert.equal(luxjsonSaved.body.data.profileBannerUrl, "https://images.example.test/luxjson-banner.webp");
    assert.equal(luxjsonSaved.body.data.isVerified, true);

    const publicLuxjson = await guest.request("/account/profile/luxjson");
    assert.equal(publicLuxjson.status, 200, JSON.stringify(publicLuxjson.body));
    assert.equal(publicLuxjson.body.data.bannerUrl, "https://images.example.test/luxjson-banner.webp");
    assert.equal(publicLuxjson.body.data.isVerified, true);
  } finally {
    await pool.query("UPDATE users SET username='admin', profile_banner_url=NULL WHERE id=$1", [adminId]);
    await pool.query("UPDATE users SET username='other', profile_banner_url=NULL WHERE id=$1", [otherId]);
  }
});
test("privacy defaults hide activity and telemetry consent rejects collection", async () => {
  let result = await player.request("/platform/telemetry", {
    method: "POST",
    body: {
      eventType: "install_failed",
      gameId: freeId,
      payload: { code: "GAME_DOWNLOAD_FAILED" },
    },
  });
  assert.equal(result.status, 202);
  assert.equal(result.body.data.accepted, false);
  result = await player.request("/platform/telemetry", {
    method: "POST",
    body: { eventType: "install_failed", payload: { password: "secret" } },
  });
  assert.equal(result.status, 400);
  result = await guest.request("/account/profile/player");
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data.recentGames, []);
  assert.deepEqual(result.body.data.achievements, []);
  assert(!("email" in result.body.data));
  assert(!("password_hash" in result.body.data));
  result = await player.request("/platform/telemetry-consent", {
    method: "PATCH",
    body: { enabled: true },
  });
  assert.equal(result.body.data.enabled, true);
  result = await player.request("/platform/telemetry", {
    method: "POST",
    body: {
      eventType: "install_failed",
      gameId: freeId,
      payload: { code: "GAME_DOWNLOAD_FAILED" },
    },
  });
  assert.equal(result.body.data.accepted, true);
  await player.request("/platform/telemetry-consent", {
    method: "PATCH",
    body: { enabled: false },
  });
  assert.equal((await player.request("/platform/telemetry-consent")).body.data.enabled, false);
  assert.equal(
    (await pool.query("SELECT count(*) FROM telemetry_events WHERE user_id=$1", [userId])).rows[0]
      .count,
    "0",
  );
  assert.equal(
    (
      await pool.query("SELECT telemetry_consent,share_game_activity FROM users WHERE id=$1", [
        userId,
      ])
    ).rows[0].telemetry_consent,
    false,
  );
});
test("changing a free game to paid invalidates old free entitlements", async () => {
  const added = await player.request(`/library/${freeId}`, { method: "POST" });
  assert.equal(added.status, 200);
  await pool.query(
    "UPDATE games SET access_type='paid',purchase_url='https://studio.itch.io/free/purchase' WHERE id=$1",
    [freeId],
  );
  const library = await player.request("/library");
  assert(!library.body.data.items.some((x) => x.id === freeId));
  const access = await pool.query(
    "SELECT revoked_at FROM user_game_entitlements WHERE user_id=$1 AND game_id=$2",
    [userId, freeId],
  );
  assert(access.rows[0].revoked_at);
});

test("game latest lists only news linked to that game and premiere stays empty without YouTube", async () => {
  await admin.request("/admin/newsletter", {
    method: "POST",
    body: { title: "Unrelated story", body: "Body" },
  });
  let result = await guest.request("/games/free/latest");
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert(result.body.data.length > 0);
  assert(result.body.data.every((item) => item.game_slug === "free"));
  assert(!result.body.data.some((item) => item.title === "Unrelated story"));
  assert.equal((await guest.request("/games/missing-game/latest")).status, 404);
  result = await guest.request("/videos/premiere");
  assert.deepEqual(result.body.data, { premiere: null });
});

test("admin game create/edit preserves storefront data and public responses never expose download configuration", async () => {
  const badge =
    '<a href="https://get.microsoft.com/installer/download/9P6P8284V337?referrer=appbadge">\n  <img src="https://get.microsoft.com/images/en-us%20light.svg">\n</a>';
  const body = {
    title: "Admin game",
    slug: "admin-game",
    shortDescription: "Created by admin",
    accessType: "free",
    status: "released",
    itchGameId: 3000,
    itchUrl: "https://studio.itch.io/free",
    downloadUrl: "https://github.com/studio/games/releases/download/v1/game.zip",
    genres: ["Adventure"],
    platforms: ["Windows"],
    microsoftStoreBadge: badge,
  };
  let result = await admin.request("/admin/game", { method: "POST", body });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  const id = result.body.data.id;
  assert.equal(
    (await pool.query("SELECT name,public FROM release_channels WHERE game_id=$1", [id])).rows[0]
      .public,
    true,
  );
  result = await admin.request(`/admin/game/${id}`);
  assert.equal(result.body.data.downloadUrl, body.downloadUrl);
  assert.equal(result.body.data.itchUrl, body.itchUrl);
  assert(result.body.data.microsoftStoreBadgeHtml);
  result = await guest.request("/games/admin-game");
  assert.equal(result.status, 200);
  assert.equal(result.body.data.downloadUrl, null);
  assert.equal(result.body.data.accessType, "free");
  assert.equal(result.body.data.microsoftStoreBadge.productId, "9P6P8284V337");
  result = await player.request(`/admin/game/${id}`);
  assert.equal(result.status, 403);
  result = await admin.request(`/admin/game/${id}`, {
    method: "PUT",
    body: {
      ...body,
      title: "Edited",
      genres: ["Puzzle"],
      microsoftStoreBadge: badge.replaceAll("\n", "\r\n\t"),
    },
  });
  assert.equal(result.status, 200);
  result = await guest.request("/games/admin-game");
  assert.deepEqual(result.body.data.genres, ["Puzzle"]);
  const news = await admin.request("/admin/newsletter", {
    method: "POST",
    body: { title: "Linked", body: "Body", gameId: id },
  });
  assert.equal(news.status, 201);
  result = await admin.request(`/admin/game/${id}`, { method: "DELETE" });
  assert.equal(result.status, 200);
  result = await guest.request(`/newswire/${news.body.data.slug}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.game_id, null);
  const events = await pool.query(
    "SELECT event_type FROM content_events WHERE entity_id=$1 ORDER BY id",
    [id],
  );
  assert.deepEqual(
    events.rows.map((event) => event.event_type),
    ["game.published", "game.updated", "game.deleted"],
  );
});

test("editing and deleting news and videos publish public content events", async () => {
  for (const [endpoint, type, initial, change] of [
    [
      "newsletter",
      "news",
      { title: "Live news", body: "Original text" },
      { title: "Live news edited", body: "Updated text" },
    ],
    [
      "video",
      "video",
      {
        title: "Live video",
        category: "Trailer",
        videoUrl: "https://youtu.be/abcdefghijk",
      },
      {
        title: "Live video edited",
        category: "Trailer",
        videoUrl: "https://youtu.be/abcdefghijk",
      },
    ],
  ]) {
    const created = await admin.request(`/admin/${endpoint}`, {
      method: "POST",
      body: initial,
    });
    assert.equal(created.status, 201);
    const id = created.body.data.id;
    const edited = await admin.request(`/admin/${endpoint}/${id}`, {
      method: "PUT",
      body: change,
    });
    assert.equal(edited.status, 200);
    const removed = await admin.request(`/admin/${endpoint}/${id}`, { method: "DELETE" });
    assert.equal(removed.status, 200);
    const events = await pool.query(
      "SELECT event_type FROM content_events WHERE entity_id=$1 ORDER BY id",
      [id],
    );
    assert.deepEqual(
      events.rows.map((event) => event.event_type),
      [`${type}.published`, `${type}.updated`, `${type}.deleted`],
    );
  }
});

test("unverified accounts do not reveal their verification state to a wrong password", async () => {
  await pool.query(
    "INSERT INTO users(email,username,password_hash) VALUES('pending@example.test','pending',$1)",
    [password],
  );
  const pending = client();
  let result = await pending.request("/auth/login", {
    method: "POST",
    body: { email: "pending@example.test", password: "WrongPassword123!" },
  });
  assert.equal(result.status, 401);
  assert.equal(result.body.error.code, "INVALID_CREDENTIALS");
  result = await pending.request("/auth/login", {
    method: "POST",
    body: { email: "pending@example.test", password: "TestPassword123!" },
  });
  assert.equal(result.status, 403);
  assert.equal(result.body.error.code, "EMAIL_NOT_VERIFIED");
});

test("protected saves reject ciphertext tampering and another account scope", async () => {
  const { encryptSecret, decryptSecret } = await import("../src/utils/secretCipher.js");
  const encrypted = encryptSecret("save-data", `save:${userId}:${freeId}:default`);
  assert.equal(decryptSecret(encrypted, `save:${userId}:${freeId}:default`), "save-data");
  assert.throws(() => decryptSecret(encrypted, `save:${otherId}:${freeId}:default`), {
    code: "SECRET_DECRYPT_FAILED",
  });
  const parts = encrypted.split(".");
  parts[3] = Buffer.alloc(16).toString("base64url");
  assert.throws(() => decryptSecret(parts.join("."), `save:${userId}:${freeId}:default`), {
    code: "SECRET_DECRYPT_FAILED",
  });
});

test("Store outages return labelled stale metadata and never create a launcher download link", async () => {
  await pool.query("UPDATE microsoft_store_products SET fetched_at=now()-interval '2 hours'");
  storeOffline = true;
  const page = await guest.request("/launcher", { language: "pt-BR" });
  assert.equal(page.status, 200);
  assert.equal(page.body.data.stale, true);
  const install = await player.request(`/library/${msId}/install-metadata`, {
    method: "POST",
    language: "pt-BR",
  });
  assert.equal(install.status, 409);
  assert.equal(install.body.error.code, "GAME_RELEASE_NOT_CONFIGURED");
  assert.match(install.body.error.message, /download/);
  await pool.query("UPDATE microsoft_store_products SET fetched_at=now()-interval '8 days'");
  const expired = await guest.request("/launcher", { language: "pt-BR" });
  assert.equal(expired.status, 502);
  assert(!JSON.stringify(expired.body).includes("provider unavailable"));
  storeOffline = false;
});

test("free website download registers library membership and disconnecting itch preserves it", async () => {
  await pool.query("DELETE FROM api_rate_limits WHERE scope='integration'");
  await pool.query("UPDATE games SET download_url=$2 WHERE id=$1", [
    msId,
    "https://downloads.example.test/free.zip",
  ]);
  try {
    const response = await player.request("/games/store/download");
    assert.equal(response.status, 200);
    assert.equal(response.body.data.downloadUrl, "https://downloads.example.test/free.zip");
    const free = (await player.request("/library")).body.data.items.find(
      (game) => game.id === msId,
    );
    assert.equal(free.isFree, true);
    assert.equal(free.accessType, "free");
    assert.equal(free.inLibrary, true);
    assert.equal((await player.request("/library/sync", { method: "POST" })).status, 200);
    assert.equal((await player.request(`/library/${paidId}`, { method: "POST" })).status, 200);
    assert((await player.request("/library")).body.data.items.some((game) => game.id === paidId));
    const disconnected = await player.request("/integrations/itch", { method: "DELETE" });
    assert.equal(disconnected.status, 200);
    assert.equal(
      (await pool.query("SELECT user_id FROM user_itch_accounts WHERE user_id=$1", [userId])).rows
        .length,
      0,
    );
    const catalog = (await player.request("/library/catalog")).body.data.items;
    assert.equal(catalog.find((game) => game.id === paidId).owned, false);
    assert.equal(catalog.find((game) => game.id === paidId).inLibrary, false);
    const library = (await player.request("/library")).body.data.items;
    assert(!library.some((game) => game.id === paidId));
    assert(library.some((game) => game.id === msId));
    assert((await other.request("/library")).body.data.items.some((game) => game.id === msId));
  } finally {
    await pool.query("UPDATE games SET download_url=null WHERE id=$1", [msId]);
  }
});

test("two-factor login persists the session on the first valid code and consumes the challenge once", async () => {
  const { default: speakeasy } = await import("speakeasy");
  const secret = "JBSWY3DPEHPK3PXP";
  await pool.query("INSERT INTO user_totp(user_id,secret,enabled) VALUES($1,$2,true)", [
    otherId,
    secret,
  ]);
  const challenge = client();
  try {
    const login = await challenge.request("/auth/login", {
      method: "POST",
      body: { email: "other@example.test", password: "TestPassword123!" },
    });
    assert.equal(login.status, 200);
    assert.equal(login.body.data.requiresTwoFactor, true);
    assert.equal((await challenge.request("/auth/me")).status, 401);
    const token = speakeasy.totp({ secret, encoding: "base32" });
    const verified = await challenge.request("/auth/verify-2fa", {
      method: "POST",
      body: { token },
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.data.id, otherId);
    assert.equal((await challenge.request("/auth/me")).status, 200);
    const repeat = await challenge.request("/auth/verify-2fa", {
      method: "POST",
      body: { token },
    });
    assert.equal(repeat.status, 401);
    assert.equal(repeat.body.error.code, "TWO_FACTOR_CHALLENGE_EXPIRED");
    assert.equal((await challenge.request("/auth/me")).status, 200);
  } finally {
    await pool.query("DELETE FROM user_totp WHERE user_id=$1", [otherId]);
  }
});

test("installation metadata uses the configured URL and rejects an unrelated build URL", async () => {
  const configured = "https://downloads.example.test/configured.zip";
  const alternate = "https://downloads.example.test/unrelated.zip";
  const channel = (
    await pool.query(
      "INSERT INTO release_channels(game_id,name,label,public) VALUES($1,'stable','Stable',true) RETURNING id",
      [msId],
    )
  ).rows[0].id;
  await pool.query("UPDATE games SET download_url=$2 WHERE id=$1", [msId, configured]);
  await pool.query(
    "INSERT INTO game_builds(game_id,channel_id,version,platform,download_url,sha256,size_bytes,status) VALUES($1,$2,'1.0.0','windows',$3,$4,100,'published')",
    [msId, channel, configured, "a".repeat(64)],
  );
  try {
    const valid = await player.request(`/library/${msId}/install-metadata`, {
      method: "POST",
    });
    assert.equal(valid.status, 200);
    assert.equal(valid.body.data.downloadUrl, configured);
    await pool.query("UPDATE game_builds SET download_url=$2 WHERE game_id=$1", [msId, alternate]);
    const different = await player.request(`/library/${msId}/install-metadata`, {
      method: "POST",
    });
    assert.notEqual(different.status, 200);
    assert(!JSON.stringify(different.body).includes(alternate));
    await pool.query("UPDATE games SET download_url=null WHERE id=$1", [msId]);
    const unavailable = await player.request(`/library/${msId}/install-metadata`, {
      method: "POST",
    });
    assert.equal(unavailable.status, 409);
    assert.equal(unavailable.body.error.code, "GAME_RELEASE_NOT_CONFIGURED");
  } finally {
    await pool.query("DELETE FROM release_channels WHERE id=$1", [channel]);
    await pool.query("UPDATE games SET download_url=null WHERE id=$1", [msId]);
  }
});

test("password reset tokens are consumed once, expire safely and invalidate authenticated and pending 2FA sessions", async () => {
  const { createHash } = await import("node:crypto");
  const { createResetToken } = await import("../src/repositories/password-resets.repository.js");
  const id = "00000000-0000-4000-8000-000000000090";
  await pool.query(
    "DELETE FROM api_rate_limits WHERE scope IN ('login','reset-password','two-factor')",
  );
  await pool.query(
    "INSERT INTO users(id,email,username,password_hash,email_verified_at) VALUES($1,$2,$3,$4,now())",
    [id, "reset-test@example.test", "reset-test", password],
  );
  const logged = client(),
    pending = client(),
    attacker = client();
  await logged.login("reset-test");
  await pool.query("INSERT INTO user_totp(user_id,secret,enabled) VALUES($1,$2,true)", [
    id,
    "JBSWY3DPEHPK3PXP",
  ]);
  const challenge = await pending.request("/auth/login", {
    method: "POST",
    body: { email: "reset-test@example.test", password: "TestPassword123!" },
  });
  assert.equal(challenge.body.data.requiresTwoFactor, true);
  const token = "a".repeat(64),
    tokenHash = createHash("sha256").update(token).digest("hex");
  await createResetToken({
    userId: id,
    tokenHash,
    expiresAt: new Date(Date.now() + 60000),
  });
  const unrelatedBefore = Number(
    (await pool.query("SELECT count(*) FROM user_sessions WHERE sess->>'userId'=$1", [userId]))
      .rows[0].count,
  );
  await attacker.request("/csrf");
  const results = await Promise.all(
    [1, 2].map(() =>
      attacker.request("/auth/reset-password", {
        method: "POST",
        body: { token, password: "NewTestPassword123!" },
      }),
    ),
  );
  assert.deepEqual(results.map((item) => item.status).sort(), [200, 400]);
  assert.equal(results.find((item) => item.status === 400).body.error.code, "INVALID_TOKEN");
  assert.equal((await logged.request("/auth/me")).status, 401);
  const { default: speakeasy } = await import("speakeasy");
  const consumedChallenge = await pending.request("/auth/verify-2fa", {
    method: "POST",
    body: { token: speakeasy.totp({ secret: "JBSWY3DPEHPK3PXP", encoding: "base32" }) },
  });
  assert.equal(consumedChallenge.body.error.code, "TWO_FACTOR_CHALLENGE_EXPIRED");
  assert.equal(
    (await pool.query("SELECT used_at FROM password_resets WHERE token_hash=$1", [tokenHash]))
      .rows[0].used_at !== null,
    true,
  );
  assert.equal(
    Number(
      (await pool.query("SELECT count(*) FROM user_sessions WHERE sess->>'userId'=$1", [userId]))
        .rows[0].count,
    ),
    unrelatedBefore,
  );
  const replay = await attacker.request("/auth/reset-password", {
    method: "POST",
    body: { token, password: "AttackerPassword123!" },
  });
  assert.equal(replay.body.error.code, "INVALID_TOKEN");
  const expired = "b".repeat(64);
  await createResetToken({
    userId: id,
    tokenHash: createHash("sha256").update(expired).digest("hex"),
    expiresAt: new Date(Date.now() - 1000),
  });
  assert.equal(
    (
      await attacker.request("/auth/reset-password", {
        method: "POST",
        body: { token: expired, password: "AttackerPassword123!" },
      })
    ).body.error.code,
    "INVALID_TOKEN",
  );
  await pool.query("DELETE FROM user_totp WHERE user_id=$1", [id]);
  assert.equal(
    (
      await attacker.request("/auth/login", {
        method: "POST",
        body: { email: "reset-test@example.test", password: "NewTestPassword123!" },
      })
    ).status,
    200,
  );
  await pool.query("DELETE FROM users WHERE id=$1", [id]);
});

test("confirmed email changes revoke login and 2FA sessions, consume their token and preserve other accounts", async () => {
  const { createPendingEmailToken, confirmEmailToken } =
    await import("../src/repositories/account-email.repository.js");
  const id = "00000000-0000-4000-8000-000000000091";
  await pool.query("DELETE FROM api_rate_limits WHERE scope='login'");
  await pool.query(
    "INSERT INTO users(id,email,username,password_hash,email_verified_at) VALUES($1,$2,$3,$4,now())",
    [id, "email-change@example.test", "email-change", password],
  );
  const logged = client(),
    pending = client();
  await logged.login("email-change");
  await pool.query("INSERT INTO user_totp(user_id,secret,enabled) VALUES($1,$2,true)", [
    id,
    "JBSWY3DPEHPK3PXP",
  ]);
  assert.equal(
    (
      await pending.request("/auth/login", {
        method: "POST",
        body: { email: "email-change@example.test", password: "TestPassword123!" },
      })
    ).body.data.requiresTwoFactor,
    true,
  );
  const hash = "c".repeat(64);
  assert(
    await createPendingEmailToken({
      userId: id,
      purpose: "change",
      email: "email-changed@example.test",
      hash,
      expiresAt: new Date(Date.now() + 60000),
    }),
  );
  const confirmed = await confirmEmailToken(hash);
  assert.equal(confirmed.newEmail, "email-changed@example.test");
  assert.equal(await confirmEmailToken(hash), null);
  assert.equal((await logged.request("/auth/me")).status, 401);
  assert.equal(
    (
      await pending.request("/auth/verify-2fa", {
        method: "POST",
        body: { token: "123456" },
      })
    ).body.error.code,
    "TWO_FACTOR_CHALLENGE_EXPIRED",
  );
  assert.equal((await player.request("/auth/me")).status, 200);
  await pool.query("DELETE FROM users WHERE id=$1", [id]);
});

test("profile updates can remove an avatar and usernames cannot collide by letter case", async () => {
  await pool.query("UPDATE users SET avatar_url=$2 WHERE id=$1", [
    otherId,
    "https://images.example.test/avatar.png",
  ]);
  const cleared = await other.request("/account", {
    method: "PATCH",
    body: { avatarUrl: null },
  });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.data.avatarUrl, null);
  const collision = await other.request("/account", {
    method: "PATCH",
    body: { username: "AdMiN" },
  });
  assert.equal(collision.status, 409);
  assert.equal(collision.body.error.code, "USERNAME_TAKEN");
  const { findUserByUsername } = await import("../src/repositories/users.repository.js");
  assert.equal((await findUserByUsername("AdMiN")).id, adminId);
});

test("hidden achievements keep their secret content out of the API response until unlocked", async () => {
  const hidden = (
    await pool.query(
      "INSERT INTO achievements(game_id,key,title,description,hidden,icon_url) VALUES($1,'hidden_security','Secret title','Secret description',true,'https://images.example.test/secret.png') RETURNING id",
      [msId],
    )
  ).rows[0].id;
  try {
    const before = (await player.request(`/platform/achievements/${msId}`)).body.data.find(
      (item) => item.id === hidden,
    );
    assert.equal(before.title, null);
    assert.equal(before.description, null);
    assert.equal(before.icon_url, null);
    await pool.query("INSERT INTO user_achievements(user_id,achievement_id) VALUES($1,$2)", [
      userId,
      hidden,
    ]);
    const after = (await player.request(`/platform/achievements/${msId}`)).body.data.find(
      (item) => item.id === hidden,
    );
    assert.equal(after.title, "Secret title");
    assert.equal(after.description, "Secret description");
    const second = (await other.request(`/platform/achievements/${msId}`)).body.data.find(
      (item) => item.id === hidden,
    );
    assert.equal(second.title, null);
  } finally {
    await pool.query("DELETE FROM achievements WHERE id=$1", [hidden]);
  }
});

test("live tickets are tied to an active session and revoked sessions cannot receive private events or reconnect", async () => {
  const { WebSocket } = await import("ws");
  const { attachRealtimeServer, signalRealtimeEvent } = await import("../src/realtime/hub.js");
  attachRealtimeServer(server);
  const id = "00000000-0000-4000-8000-000000000093";
  await pool.query("DELETE FROM api_rate_limits WHERE scope IN ('login','integration')");
  await pool.query(
    "INSERT INTO users(id,email,username,password_hash,email_verified_at) VALUES($1,$2,$3,$4,now())",
    [id, "live-test@example.test", "live-test", password],
  );
  const account = client();
  await account.login("live-test");
  const ticket = (await account.request("/platform/live-ticket")).body.data.ticket;
  const identity = JSON.parse(Buffer.from(ticket.split(".")[0], "base64url").toString());
  assert.equal(identity.userId, id);
  assert.equal(typeof identity.sessionId, "string");
  const websocket = new WebSocket(
    base.replace("http:", "ws:") + "/live?ticket=" + encodeURIComponent(ticket),
    { origin: "https://deadsmilegames.vercel.app" },
  );
  const received = [];
  websocket.on("message", (message) => received.push(JSON.parse(message)));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WebSocket connection timeout")), 2000);
    websocket.once("message", () => {
      clearTimeout(timer);
      resolve();
    });
    websocket.once("error", reject);
  });
  assert.equal(received[0].authenticated, true);
  await signalRealtimeEvent({
    id: 90001,
    event_type: "wishlist.updated",
    audience_user_id: id,
    payload: { gameId: freeId, inWishlist: true },
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(received.at(-1).id, 90001);
  await pool.query("DELETE FROM user_sessions WHERE sid=$1", [identity.sessionId]);
  const closed = new Promise((resolve) => websocket.once("close", resolve));
  await signalRealtimeEvent({
    id: 90002,
    event_type: "wishlist.updated",
    audience_user_id: id,
    payload: { gameId: freeId, inWishlist: false },
  });
  await closed;
  assert(!received.some((item) => item.id === 90002));
  const reused = new WebSocket(
    base.replace("http:", "ws:") + "/live?ticket=" + encodeURIComponent(ticket),
    { origin: "https://deadsmilegames.vercel.app" },
  );
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reused.terminate();
      reject(new Error("Revoked ticket did not fail"));
    }, 2000);
    reused.once("open", () => {
      clearTimeout(timer);
      reject(new Error("Revoked ticket connected"));
    });
    reused.once("error", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  reused.terminate();
  await pool.query("DELETE FROM users WHERE id=$1", [id]);
});

test("Account library, sessions and achievements remain isolated by owner", async () => {
  const accountId = "00000000-0000-4000-8000-000000000101";
  const abbyId = "00000000-0000-4000-8000-000000000102";
  await pool.query(
    "INSERT INTO users(id,email,username,password_hash,email_verified_at) VALUES($1,'platform@example.test','platform',$2,now())",
    [accountId, password],
  );
  await pool.query(
    "INSERT INTO games(id,title,slug,short_description,status,access_type) VALUES($1,'Abby','abbys-restless-heart','Abby','released','free')",
    [abbyId],
  );
  await pool.query(
    "INSERT INTO achievements(game_id,key,title,description,points,hidden) VALUES($1,'first_checkpoint','Checkpoint','Reached a checkpoint',20,false),($1,'no_death_finish','Secret','Finished without deaths',150,true)",
    [abbyId],
  );
  const playerSession = client();
  await playerSession.login("platform");
  const account = (await playerSession.request("/auth/me")).body.data;
  assert.equal(account.id, accountId);
  assert.equal(account.password_hash, undefined);

  const game = await playerSession.request("/games/abbys-restless-heart");
  assert.equal(game.status, 200);
  assert.equal(game.body.data.id, abbyId);
  const library = await playerSession.request(`/library/${abbyId}`, { method: "POST", body: {} });
  assert.equal(library.status, 200);
  assert.equal(library.body.data.inLibrary, true);
  const started = await playerSession.request("/platform/sessions", {
    method: "POST",
    body: { gameId: abbyId, gameVersion: "0.38", platform: "windows" },
  });
  assert.equal(started.status, 201, JSON.stringify(started.body));
  const sessionId = started.body.data.id;
  assert.equal(
    (
      await pool.query("SELECT platform,user_id,game_version FROM game_sessions WHERE id=$1", [
        sessionId,
      ])
    ).rows[0].platform,
    "windows",
  );
  const invalid = await playerSession.request("/platform/sessions", {
    method: "POST",
    body: { gameId: abbyId, platform: "windows-forged" },
  });
  assert.equal(invalid.status, 400);
  const unlockPath = `/platform/achievements/${abbyId}/first_checkpoint/unlock`;
  const rejected = await playerSession.request(unlockPath, {
    method: "POST",
    body: { expectedUserId: otherId },
  });
  assert.equal(rejected.status, 409);
  assert.equal(rejected.body.error.code, "ACCOUNT_CHANGED");
  const first = await playerSession.request(unlockPath, {
    method: "POST",
    body: { expectedUserId: accountId },
  });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  const repeated = await playerSession.request(unlockPath, {
    method: "POST",
    body: { expectedUserId: accountId },
  });
  assert.equal(repeated.body.data.unlocked_at, first.body.data.unlocked_at);
  const achievements = (await playerSession.request(`/platform/achievements/${abbyId}`)).body.data;
  assert(achievements.find((item) => item.key === "first_checkpoint").unlocked_at);
  assert.equal(achievements.find((item) => item.key === "no_death_finish").description, null);
  const another = (await other.request(`/platform/achievements/${abbyId}`)).body.data;
  assert.equal(another.find((item) => item.key === "first_checkpoint").unlocked_at, null);
  assert.equal(
    (await other.request(`/platform/sessions/${sessionId}/end`, { method: "POST", body: {} }))
      .status,
    409,
  );
  const ended = await playerSession.request(`/platform/sessions/${sessionId}/end`, {
    method: "POST",
    body: {},
  });
  assert.equal(ended.status, 200);
  assert(ended.body.data.duration_ms >= 0);
  assert.equal(
    (await playerSession.request(`/platform/sessions/${sessionId}/end`, { method: "POST", body: {} }))
      .status,
    409,
  );
  assert.equal(
    (await playerSession.request(`/library/${paidId}`, { method: "POST", body: {} })).body.error.code,
    "ITCH_NOT_CONNECTED",
  );
  await playerSession.request("/auth/logout", { method: "POST", body: {} });
  assert.equal((await playerSession.request("/auth/me")).status, 401);
  assert.equal((await playerSession.request(`/platform/achievements/${abbyId}`)).status, 401);
});


test("pre-orders are free-only, keep age ratings private, require email confirmation and reject duplicates", async () => {
  const { createHash, createHmac } = await import("node:crypto");
  const preorderGuest = client();
  const originalFreeGame = (await pool.query(
    "SELECT status, release_date FROM games WHERE id=$1",
    [freeId],
  )).rows[0];
  await pool.query(
    `UPDATE games
     SET status='in_development',
         release_date=(CURRENT_DATE + interval '7 days')::date,
         access_type='free',
         preorder_enabled=true,
         preorder_starts_at=now()-interval '1 hour',
         preorder_ends_at=now()+interval '1 day',
         preorder_age_ratings=$2::jsonb,
         preorder_reward_type='package',
         preorder_reward_zip=decode('504b0304','hex')
     WHERE id=$1`,
    [freeId, JSON.stringify({ en: 13, "pt-BR": 18, es: 13 })],
  );
  await pool.query(
    `UPDATE games
     SET access_type='paid',
         preorder_enabled=true,
         preorder_starts_at=now()-interval '1 hour',
         preorder_ends_at=now()+interval '1 day',
         preorder_reward_type='package',
         preorder_reward_zip=decode('504b0304','hex')
     WHERE id=$1`,
    [paidId],
  );
  try {
    const info = await preorderGuest.request("/preorders/free", { language: "pt-BR" });
    assert.equal(info.status, 200, JSON.stringify(info.body));
    assert.equal(Object.hasOwn(info.body.data, "preorderAgeRatings"), false);
    assert.equal(Object.hasOwn(info.body.data, "minAge"), false);

    const publicGame = await preorderGuest.request("/games/free", { language: "pt-BR" });
    assert.equal(publicGame.status, 200);
    assert.equal(Object.hasOwn(publicGame.body.data, "preorderAgeRatings"), false);

    const anonymousSignup = await preorderGuest.request("/preorders/free", {
      method: "POST",
      language: "pt-BR",
      body: { firstName: "Player", lastName: "One", age: 18, email: "player@example.test", locale: "pt-BR" },
    });
    assert.equal(anonymousSignup.status, 401);
    assert.equal(anonymousSignup.body.error.code, "UNAUTHENTICATED");

    const deniedAge = await player.request("/preorders/free", {
      method: "POST",
      language: "pt-BR",
      body: { firstName: "Player", lastName: "One", age: 17, email: "too-young@example.test", locale: "pt-BR" },
    });
    assert.equal(deniedAge.status, 403);
    assert.equal(deniedAge.body.error.code, "PREORDER_AGE_RESTRICTED");
    assert.equal(
      (await pool.query("SELECT count(*)::int AS count FROM game_preorders WHERE game_id=$1 AND email=$2", [freeId, "too-young@example.test"])).rows[0].count,
      0,
    );

    const paidInfo = await preorderGuest.request("/preorders/paid");
    assert.equal(paidInfo.status, 404);
    const paidSignup = await player.request("/preorders/paid", {
      method: "POST",
      body: { firstName: "Player", lastName: "Paid", age: 30, email: "paid-preorder@example.test" },
    });
    assert.equal(paidSignup.status, 404);

    const { getPreorderedLibraryItems, hasPreorderForUser } = await import("../src/services/preorder-library.service.js");
    const { rows: pendingPlayerRows } = await pool.query(
      `INSERT INTO game_preorders
       (game_id, first_name, last_name, age, locale, email, confirmation_token_hash, confirmation_expires_at)
       VALUES ($1,'Player','Pending',18,'pt-BR','player@example.test',$2,now()+interval '1 hour')
       RETURNING id`,
      [freeId, createHash("sha256").update("unconfirmed-player-token").digest("hex")],
    );
    assert.equal((await getPreorderedLibraryItems(userId)).some((item) => item.id === freeId), false);
    assert.equal(await hasPreorderForUser(userId, freeId), false);
    const pendingCatalog = await player.request("/library/catalog");
    const pendingCatalogGame = pendingCatalog.body.data.items.find((item) => item.slug === "free");
    assert.equal(Boolean(pendingCatalogGame?.preorderRegistered), false);
    await pool.query("DELETE FROM game_preorders WHERE id=$1", [pendingPlayerRows[0].id]);

    const rawToken = "one-time-preorder-confirmation-token-123456";
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await pool.query(
      `INSERT INTO game_preorders
       (game_id, first_name, last_name, age, locale, email, confirmation_token_hash, confirmation_expires_at)
       VALUES ($1,'Pending','Player',18,'pt-BR','player@example.test',$2,now()+interval '1 hour')`,
      [freeId, tokenHash],
    );
    const confirmed = await preorderGuest.request("/preorders/confirm/" + rawToken, {
      method: "POST",
      body: {},
    });
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    assert.equal(confirmed.body.data.confirmed, true);
    assert.equal(confirmed.body.data.slug, "free");
    const registration = (await pool.query(
      "SELECT confirmed_at, confirmation_token_hash, confirmation_expires_at, reward_code, code_hash FROM game_preorders WHERE game_id=$1 AND email=$2",
      [freeId, "player@example.test"],
    )).rows[0];
    assert(registration.confirmed_at);
    assert.equal(registration.confirmation_token_hash, null);
    assert.equal(registration.confirmation_expires_at, null);
    assert.equal(/^[0-9]{6}$/.test(registration.reward_code), true);
    assert.equal(registration.code_hash, createHmac("sha256", process.env.DATA_ENCRYPTION_KEY).update("deadsmile:preorder-reward-code:v1:").update(registration.reward_code).digest("hex"));
    await pool.query(
      "UPDATE game_preorders SET code_hash=$3 WHERE game_id=$1 AND email=$2",
      [freeId, "player@example.test", createHash("sha256").update(registration.reward_code).digest("hex")],
    );
    const anonymousRedeem = await preorderGuest.request("/preorders/redeem", {
      method: "POST",
      body: { code: registration.reward_code },
    });
    assert.equal(anonymousRedeem.status, 401);
    assert.equal(anonymousRedeem.body.error.code, "UNAUTHENTICATED");
    const managementStatus = await player.request("/preorders/free/status");
    assert.equal(managementStatus.body.data.rewardCode, null, "the code stays private until the preorder ends");
    assert.equal(managementStatus.body.data.rewardRedeemable, false);
    const earlyRedemption = await player.request("/preorders/redeem", {
      method: "POST",
      body: { code: registration.reward_code },
    });
    assert.equal(earlyRedemption.status, 409);
    assert.equal(earlyRedemption.body.error.code, "PREORDER_NOT_ENDED");
    assert.equal(await hasPreorderForUser(userId, freeId), true);
    assert.equal((await getPreorderedLibraryItems(userId)).some((item) => item.slug === "free"), true,
      "a confirmed matching email belongs in the reserved library");
    const confirmedCatalog = await player.request("/library/catalog");
    const confirmedCatalogGame = confirmedCatalog.body.data.items.find((item) => item.slug === "free");
    assert.equal(confirmedCatalogGame?.preorderRegistered, true);
    assert.equal(confirmedCatalogGame?.inLibrary, true);
    assert.equal(confirmedCatalogGame?.preorderLocked, true);
    assert.equal(confirmedCatalogGame?.downloadUrl, null);

    const duplicate = await player.request("/preorders/free", {
      method: "POST",
      language: "pt-BR",
      body: { firstName: "Pending", lastName: "Player", age: 18, email: "player@example.test", locale: "pt-BR" },
    });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, "PREORDER_ALREADY_REGISTERED");
    assert.equal(
      (await pool.query("SELECT count(*)::int AS count FROM game_preorders WHERE game_id=$1 AND email=$2", [freeId, "player@example.test"])).rows[0].count,
      1,
    );

    const reusedToken = await preorderGuest.request("/preorders/confirm/" + rawToken, {
      method: "POST",
      body: {},
    });
    assert.equal(reusedToken.status, 410);

    await pool.query("UPDATE games SET preorder_ends_at=now()-interval '1 second' WHERE id=$1", [freeId]);
    const endedStatus = await player.request("/preorders/free/status");
    assert.equal(endedStatus.body.data.rewardRedeemable, true);
    assert.equal(endedStatus.body.data.rewardCode, registration.reward_code, "the code appears once the preorder has ended");

    const earlyGameDownload = await player.request("/games/free/download");
    assert.equal(earlyGameDownload.status, 409, JSON.stringify(earlyGameDownload.body));
    assert.equal(earlyGameDownload.body.error.code, "GAME_NOT_RELEASED");

    const earlyLauncherDownload = await player.request(`/library/${freeId}/install-metadata`, { method: "POST" });
    assert.equal(earlyLauncherDownload.status, 409, JSON.stringify(earlyLauncherDownload.body));
    assert.equal(earlyLauncherDownload.body.error.code, "GAME_NOT_RELEASED");
    await pool.query(
      "UPDATE game_preorders SET reward_code=NULL WHERE game_id=$1 AND user_id=$2 AND email=$3",
      [freeId, userId, "player@example.test"],
    );
    const successfulRedemption = await player.request("/preorders/redeem", {
      method: "POST",
      body: { code: registration.reward_code },
    });
    assert.equal(successfulRedemption.status, 200, JSON.stringify(successfulRedemption.body));
    assert.equal(successfulRedemption.body.data.rewardUrl, "/games/free/preorder/reward");

    const redeemedRecord = (await pool.query(
      "SELECT user_id,first_name,last_name,age,email,code_hash,reward_code,redeemed_at FROM game_preorders WHERE game_id=$1",
      [freeId],
    )).rows[0];
    assert.equal(String(redeemedRecord.user_id), String(userId));
    assert.equal(redeemedRecord.first_name, null);
    assert.equal(redeemedRecord.last_name, null);
    assert.equal(redeemedRecord.age, null);
    assert.equal(redeemedRecord.email, null);
    assert.equal(redeemedRecord.code_hash, createHmac("sha256", process.env.DATA_ENCRYPTION_KEY).update("deadsmile:preorder-reward-code:v1:").update(registration.reward_code).digest("hex"));
    assert.equal(redeemedRecord.reward_code, null);
    assert(redeemedRecord.redeemed_at);

    const redeemedStatus = await player.request("/preorders/free/status");
    assert.equal(redeemedStatus.body.data.rewardRedeemed, true);
    assert.equal(redeemedStatus.body.data.rewardCode, null);
    const claimedReward = await player.request("/preorders/free/reward");
    assert.equal(claimedReward.status, 200, JSON.stringify(claimedReward.body));
    assert.equal(claimedReward.body.data.downloadAvailable, true);
    assert.equal(claimedReward.body.data.downloadUrl, "/preorders/free/reward/download");
    const replayedClaim = await player.request("/preorders/free/reward");
    assert.equal(replayedClaim.status, 200, JSON.stringify(replayedClaim.body));

    const cancelRedeemedReward = await player.request("/preorders/free", { method: "DELETE" });
    assert.equal(cancelRedeemedReward.status, 404);
    const preservedAfterCancel = await player.request("/preorders/free/reward");
    assert.equal(preservedAfterCancel.status, 200, "cancellation must not delete a redeemed reward");

    const ownerRedeemsAgain = await player.request("/preorders/redeem", {
      method: "POST",
      body: { code: registration.reward_code },
    });
    assert.equal(ownerRedeemsAgain.status, 200, JSON.stringify(ownerRedeemsAgain.body));
    assert.equal(ownerRedeemsAgain.body.data.alreadyRedeemed, true);
    assert.equal(ownerRedeemsAgain.body.data.rewardUrl, "/games/free/preorder/reward");

    const otherRedeemsAgain = await other.request("/preorders/redeem", {
      method: "POST",
      language: "pt-BR",
      forwardedFor: "198.51.100.44",
      body: { code: registration.reward_code },
    });
    assert.equal(otherRedeemsAgain.status, 409, JSON.stringify(otherRedeemsAgain.body));
    assert.equal(otherRedeemsAgain.body.error.code, "PREORDER_CODE_ALREADY_REDEEMED");
    const otherReward = await other.request("/preorders/free/reward");
    assert.equal(otherReward.status, 404);
    const anonymousReward = await guest.request("/preorders/free/reward");
    assert.equal(anonymousReward.status, 401);
  } finally {
    await pool.query("DELETE FROM game_preorders WHERE game_id IN ($1,$2)", [freeId, paidId]);
    await pool.query(
      "UPDATE games SET preorder_enabled=false, preorder_starts_at=NULL, preorder_ends_at=NULL, preorder_age_ratings=$2::jsonb, preorder_reward_type=NULL, preorder_reward_zip=NULL, access_type=CASE WHEN id=$1 THEN 'free' ELSE 'paid' END, status=CASE WHEN id=$1 THEN $4 ELSE status END, release_date=CASE WHEN id=$1 THEN $5::date ELSE release_date END WHERE id IN ($1,$3)",
      [freeId, JSON.stringify({ en: 13, "pt-BR": 13, es: 13 }), paidId, originalFreeGame.status, originalFreeGame.release_date],
    );
  }
});


test("pre-order cancellation deletes personal details and preserves the two-per-day limit", async () => {
  await pool.query("DELETE FROM game_preorders WHERE game_id=$1", [freeId]);
  await pool.query("DELETE FROM game_preorder_daily_limits WHERE user_id=$1 AND game_id=$2", [userId, freeId]);
  await pool.query(
    `UPDATE games SET access_type='free', preorder_enabled=true,
      preorder_starts_at=now()-interval '1 hour', preorder_ends_at=now()+interval '1 day',
      preorder_age_ratings=$2::jsonb, preorder_reward_type='package',
      preorder_reward_zip=decode('504b0304','hex') WHERE id=$1`,
    [freeId, JSON.stringify({ en: 13, "pt-BR": 13, es: 13 })],
  );
  try {
    const anonymousCancel = await guest.request("/preorders/free", { method: "DELETE" });
    assert([401, 403].includes(anonymousCancel.status), JSON.stringify(anonymousCancel.body));

    const initial = await player.request("/preorders/free/status");
    assert.equal(initial.status, 200, JSON.stringify(initial.body));
    assert.equal(initial.body.data.attemptsRemaining, 2);
    assert.equal(initial.body.data.hasPreorderRecord, false);

    const first = await player.request("/preorders/free", {
      method: "POST",
      language: "pt-BR",
      body: { firstName: "First", lastName: "Entry", age: 22, email: "player@example.test", locale: "pt-BR" },
    });
    assert.equal(first.status, 202, JSON.stringify(first.body));
    assert.equal(first.body.data.attemptsRemaining, 1);
    let record = (await pool.query("SELECT user_id,first_name,last_name,age,email FROM game_preorders WHERE game_id=$1", [freeId])).rows[0];
    assert.equal(record.user_id, userId);
    assert.equal(record.first_name, "First");
    assert.equal(record.last_name, "Entry");
    assert.equal(Number(record.age), 22);

    const pendingStatus = await player.request("/preorders/free/status");
    assert.equal(pendingStatus.body.data.preorderStatus, "pending");
    const cancelled = await player.request("/preorders/free", { method: "DELETE" });
    assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));
    assert.equal(cancelled.body.data.cancelled, true);
    assert.equal(cancelled.body.data.attemptsRemaining, 1);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM game_preorders WHERE game_id=$1", [freeId])).rows[0].count, 0);
    assert.equal(
      (await pool.query("SELECT attempts::int AS attempts FROM game_preorder_daily_limits WHERE user_id=$1 AND game_id=$2 AND activity_date=(now() AT TIME ZONE 'America/Sao_Paulo')::date", [userId, freeId])).rows[0].attempts,
      1,
    );

    const second = await player.request("/preorders/free", {
      method: "POST",
      language: "pt-BR",
      body: { firstName: "Second", lastName: "Entry", age: 25, email: "player@example.test", locale: "pt-BR" },
    });
    assert.equal(second.status, 202, JSON.stringify(second.body));
    assert.equal(second.body.data.attemptsRemaining, 0);
    record = (await pool.query("SELECT first_name,last_name,age,email FROM game_preorders WHERE game_id=$1", [freeId])).rows[0];
    assert.equal(record.first_name, "Second");
    assert.equal(record.last_name, "Entry");
    assert.equal(Number(record.age), 25);

    const cancelledAgain = await player.request("/preorders/free", { method: "DELETE" });
    assert.equal(cancelledAgain.status, 200);
    assert.equal(cancelledAgain.body.data.attemptsRemaining, 0);
    const third = await player.request("/preorders/free", {
      method: "POST",
      language: "pt-BR",
      body: { firstName: "Third", lastName: "Entry", age: 25, email: "player@example.test", locale: "pt-BR" },
    });
    assert.equal(third.status, 429, JSON.stringify(third.body));
    assert.equal(third.body.error.code, "PREORDER_DAILY_LIMIT");
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM game_preorders WHERE game_id=$1", [freeId])).rows[0].count, 0);
    const finalStatus = await player.request("/preorders/free/status");
    assert.equal(finalStatus.body.data.attemptsUsed, 2);
    assert.equal(finalStatus.body.data.attemptsRemaining, 0);
    assert.equal(finalStatus.body.data.hasPreorderRecord, false);
  } finally {
    await pool.query("DELETE FROM game_preorders WHERE game_id=$1", [freeId]);
    await pool.query("DELETE FROM game_preorder_daily_limits WHERE user_id=$1 AND game_id=$2", [userId, freeId]);
    await pool.query(
      "UPDATE games SET preorder_enabled=false,preorder_starts_at=NULL,preorder_ends_at=NULL,preorder_age_ratings=$2::jsonb,preorder_reward_type=NULL,preorder_reward_zip=NULL,access_type='free' WHERE id=$1",
      [freeId, JSON.stringify({ en: 13, "pt-BR": 13, es: 13 })],
    );
  }
});
