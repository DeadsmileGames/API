import crypto from "node:crypto";

const TOKEN_ISSUER = "deadsmile-games-api";
const TOKEN_AUDIENCE = "deadsmile-mobile-app";
const TOKEN_TTL_SECONDS = 15 * 60;
const TOKEN_USE = "mobile_access";

export class MobileAccessTokenError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function keyFromSecret(secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new MobileAccessTokenError("INVALID_ACCESS_TOKEN");
  }
  return crypto.createHmac("sha256", secret).update("deadsmile:mobile-access-token:v1").digest();
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decode(value) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new MobileAccessTokenError("INVALID_ACCESS_TOKEN");
  }
}

function sign(input, secret) {
  return crypto.createHmac("sha256", keyFromSecret(secret)).update(input).digest("base64url");
}

export function issueMobileAccessToken({ userId, sessionId, sessionSecret, now = Date.now() }) {
  if (!userId || !sessionId) throw new MobileAccessTokenError("INVALID_ACCESS_TOKEN");
  const issuedAt = Math.floor(now / 1000);
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    iss: TOKEN_ISSUER,
    aud: TOKEN_AUDIENCE,
    typ: TOKEN_USE,
    sub: String(userId),
    sid: String(sessionId),
    jti: crypto.randomUUID(),
    iat: issuedAt,
    nbf: issuedAt - 1,
    exp: issuedAt + TOKEN_TTL_SECONDS,
  });
  const unsigned = header + "." + payload;
  return unsigned + "." + sign(unsigned, sessionSecret);
}

export function verifyMobileAccessToken(token, { sessionSecret, now = Date.now() }) {
  if (typeof token !== "string" || token.length > 4096) {
    throw new MobileAccessTokenError("INVALID_ACCESS_TOKEN");
  }
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new MobileAccessTokenError("INVALID_ACCESS_TOKEN");
  }
  const header = decode(parts[0]);
  const payload = decode(parts[1]);
  if (header?.alg !== "HS256" || header?.typ !== "JWT") {
    throw new MobileAccessTokenError("INVALID_ACCESS_TOKEN");
  }
  const expected = Buffer.from(sign(parts[0] + "." + parts[1], sessionSecret));
  const actual = Buffer.from(parts[2]);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new MobileAccessTokenError("INVALID_ACCESS_TOKEN");
  }
  const current = Math.floor(now / 1000);
  if (payload?.exp <= current) throw new MobileAccessTokenError("ACCESS_TOKEN_EXPIRED");
  if (
    payload?.iss !== TOKEN_ISSUER ||
    payload?.aud !== TOKEN_AUDIENCE ||
    payload?.typ !== TOKEN_USE ||
    typeof payload?.sub !== "string" ||
    !payload.sub ||
    typeof payload?.sid !== "string" ||
    !payload.sid ||
    !Number.isInteger(payload?.iat) ||
    !Number.isInteger(payload?.nbf) ||
    !Number.isInteger(payload?.exp) ||
    payload.exp <= payload.iat ||
    payload.nbf > current ||
    payload.iat > current + 60 ||
    payload.exp - payload.iat > TOKEN_TTL_SECONDS
  ) {
    throw new MobileAccessTokenError("INVALID_ACCESS_TOKEN");
  }
  return payload;
}
