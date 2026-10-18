import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "test-session-secret-that-is-long-enough";
process.env.DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:5432/test";
process.env.FRONTEND_URL = "https://deadsmilegames.vercel.app";

const { verifyCsrf } = await import("../src/middleware/csrf.js");
const token = "a".repeat(64);

function run({ site, origin, cookieToken = token, headerToken = token, method = "POST" } = {}) {
  let continued = false;
  const response = {
    locals: { locale: "en" },
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  const values = {
    "sec-fetch-site": site,
    origin,
    "x-csrf-token": headerToken,
  };
  const request = {
    method,
    session: { csrfToken: cookieToken },
    signedCookies: { "deadsmile.csrf": cookieToken },
    get(name) {
      return values[String(name).toLowerCase()] ?? undefined;
    },
  };
  verifyCsrf(request, response, () => {
    continued = true;
  });
  return { continued, response };
}

test("blocks explicit cross-site unsafe requests from untrusted origins", () => {
  const result = run({ site: "cross-site", origin: "https://attacker.example" });
  assert.equal(result.continued, false);
  assert.equal(result.response.statusCode, 403);
  assert.equal(result.response.body.error.code, "CSRF_VALIDATION_FAILED");
});

test("permits frontend-to-API requests marked cross-site when origin and CSRF tokens are valid", () => {
  const result = run({
    site: "cross-site",
    origin: "https://deadsmilegames.vercel.app",
  });
  assert.equal(result.continued, true);
  assert.equal(result.response.statusCode, 200);
});

test("continues to require a matching CSRF cookie and header", () => {
  const result = run({
    site: "same-origin",
    origin: "https://deadsmilegames.vercel.app",
    headerToken: "b".repeat(64),
  });
  assert.equal(result.continued, false);
  assert.equal(result.response.statusCode, 403);
});

test("allows safe methods without a CSRF token", () => {
  const result = run({ method: "GET", site: "cross-site", origin: "https://attacker.example", cookieToken: "", headerToken: "" });
  assert.equal(result.continued, true);
});
