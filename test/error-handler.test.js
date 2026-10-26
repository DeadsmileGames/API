import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "production";
process.env.SESSION_SECRET ||= "test-session-secret-that-is-long-enough";
process.env.DATABASE_URL ||= "postgresql://postgres:postgres@localhost:5432/deadsmile_test";
process.env.DATA_ENCRYPTION_KEY ||= "test-data-encryption-key-that-is-long-enough";

const { errorHandler } = await import("../src/middleware/errorHandler.js");
const { publicErrorMessage } = await import("../src/utils/publicErrors.js");

function createResponse({ headersSent = false, locale = "en" } = {}) {
  return {
    headersSent,
    locals: { locale },
    statusCode: 200,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test("delegates errors to Express when response headers were already sent", () => {
  const error = new Error("stream failed");
  const response = createResponse({ headersSent: true });
  let nextError;

  const result = errorHandler(
    error,
    { path: "/api/games/download", method: "GET" },
    response,
    (received) => {
      nextError = received;
      return "delegated";
    },
  );

  assert.equal(result, "delegated");
  assert.equal(nextError, error);
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload, undefined);
});

test("returns a safe localized error before response headers are sent", () => {
  const response = createResponse({ locale: "pt-BR" });
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    errorHandler(
      new Error("private database connection details"),
      { path: "/api/test", method: "GET" },
      response,
      () => assert.fail("Unexpected delegation"),
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.statusCode, 500);
  assert.equal(response.payload.error.code, "INTERNAL_ERROR");
  assert.equal(response.payload.error.locale, "pt-BR");
  assert.equal(response.payload.error.message, publicErrorMessage("INTERNAL_ERROR", 500, "pt-BR"));
  assert.doesNotMatch(JSON.stringify(response.payload), /private database connection details/);
});
