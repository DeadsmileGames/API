import test from "node:test";
import assert from "node:assert/strict";
import {
  extractPageTitle,
  isPublicAddress,
  normalizePreviewUrl,
} from "../src/utils/linkPreview.js";

test("prefers social title metadata and decodes HTML entities", () => {
  assert.equal(
    extractPageTitle(
      '<html><head><title>Fallback</title><meta property="og:title" content="A &amp; B Game"></head></html>',
    ),
    "A & B Game",
  );
});

test("falls back to the document title and normalizes whitespace", () => {
  assert.equal(extractPageTitle("<title>  Example\n  Site </title>"), "Example Site");
});

test("rejects unsafe URL protocols, credentials, local domains, and custom ports", () => {
  assert.equal(normalizePreviewUrl("javascript:alert(1)"), null);
  assert.equal(normalizePreviewUrl("https://user:pass@example.com/"), null);
  assert.equal(normalizePreviewUrl("https://localhost/"), null);
  assert.equal(normalizePreviewUrl("https://service.internal/"), null);
  assert.equal(normalizePreviewUrl("https://example.com:8443/"), null);
  assert.equal(normalizePreviewUrl("https://example.com/")?.href, "https://example.com/");
});

test("blocks private and reserved IP addresses", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.2",
    "169.254.1.1",
    "100.64.0.1",
    "192.0.2.1",
    "224.0.0.1",
    "::1",
    "fe80::1",
    "fc00::1",
    "2001:db8::1",
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});
