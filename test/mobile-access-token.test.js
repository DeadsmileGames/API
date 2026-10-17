import { test } from "node:test";
import assert from "node:assert/strict";
import { issueMobileAccessToken, verifyMobileAccessToken } from "../src/utils/mobile-access-token.js";

const sessionSecret = "test-only-session-secret-that-is-long-enough-123456";
const now = 1_800_000_000_000;

test("mobile access tokens include a short-lived identity bound to the session", () => {
  const token = issueMobileAccessToken({ userId: "account-1", sessionId: "session-1", sessionSecret, now });
  const claims = verifyMobileAccessToken(token, { sessionSecret, now });
  assert.equal(claims.sub, "account-1");
  assert.equal(claims.sid, "session-1");
  assert.equal(claims.aud, "deadsmile-mobile-app");
  assert.equal(claims.exp - claims.iat, 900);
});

test("tampered tokens are rejected", () => {
  const token = issueMobileAccessToken({ userId: "account-1", sessionId: "session-1", sessionSecret, now });
  assert.throws(
    () => verifyMobileAccessToken(token.slice(0, -1) + (token.endsWith("a") ? "b" : "a"), { sessionSecret, now }),
    { code: "INVALID_ACCESS_TOKEN" },
  );
});

test("expired tokens are rejected", () => {
  const token = issueMobileAccessToken({ userId: "account-1", sessionId: "session-1", sessionSecret, now });
  assert.throws(
    () => verifyMobileAccessToken(token, { sessionSecret, now: now + 901_000 }),
    { code: "ACCESS_TOKEN_EXPIRED" },
  );
});

test("tokens with a different signing secret are rejected", () => {
  const token = issueMobileAccessToken({ userId: "account-1", sessionId: "session-1", sessionSecret, now });
  assert.throws(
    () => verifyMobileAccessToken(token, { sessionSecret: sessionSecret + "x", now }),
    { code: "INVALID_ACCESS_TOKEN" },
  );
});
