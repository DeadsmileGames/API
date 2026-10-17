import test from "node:test";
import assert from "node:assert/strict";
import { brandedEmail } from "../src/services/email-template.js";

test("shared email template matches the original newsletter HTML fragment", () => {
  const html = brandedEmail({
    heading: "Confirm your subscription",
    intro: "Confirm this address to receive new games, Newswire stories and videos from Deadsmile Games.",
    actionLabel: "Confirm email",
    actionUrl: "https://deadsmilegames.example/newsletter/confirm?token=sample",
    footer: "If you did not request this, you can ignore this message.",
  });

  assert.match(html, /^<div style="font-family:Arial,sans-serif;background:#0b0b0b;color:#f5f1e8;padding:32px;max-width:560px;margin:auto;border-radius:18px;">/);
  assert.match(html, /<h1 style="font-size:28px;line-height:1\.15;margin:0 0 12px;">Confirm your subscription<\/h1>/);
  assert.match(html, /<p style="color:#b9b6af;line-height:1\.6;margin:0 0 24px;">Confirm this address/);
  assert.match(html, /background:#f5f1e8;color:#0b0b0b;padding:13px 20px;border-radius:999px;font-weight:700;text-decoration:none;/);
  assert.match(html, /<p style="color:#6f6d68;font-size:12px;margin:30px 0 0;">If you did not request this/);
  assert.doesNotMatch(html, /<table|border:1px solid|border-radius:14px|DEADSMILE <span/);
});

test("the legacy template escapes text and action URLs", () => {
  const html = brandedEmail({
    heading: "<script>alert(1)</script>",
    intro: "<img src=x onerror=alert(1)>",
    actionLabel: "Confirm",
    actionUrl: "https://example.test/?q=\"unsafe",
  });

  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});
