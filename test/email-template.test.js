import test from "node:test";
import assert from "node:assert/strict";
import { brandedEmail } from "../src/services/email-template.js";

test("all branded emails use the original borderless Newswire layout by default", () => {
  const html = brandedEmail({
    lang: "pt-BR",
    preheader: "Confirme sua inscrição",
    eyebrow: "PRÉ-VENDA",
    heroImageUrl: "https://cdn.example.test/game-cover.jpg",
    heading: "Confirme sua pré-venda",
    intro: "Recebemos seu pedido para participar.",
    bodyHtml: "<p>O link expira em 24 horas.</p>",
    actionLabel: "Confirmar pré-venda",
    actionUrl: "https://deadsmilegames.example/games/sample/preorder/confirm/token",
    footer: "Se você não solicitou esta inscrição, ignore esta mensagem.",
  });

  assert.match(html, /<html lang="pt-BR">/);
  assert.match(html, /background:#0f0f0f;border:0;border-radius:0;overflow:visible/);
  assert.doesNotMatch(html, /border:1px solid #3d3d3d;border-radius:14px/);
  assert.match(html, /DEADSMILE <span style="color:#ff3b3b">GAMES<\/span>/);
  assert.match(html, /PRÉ-VENDA/);
  assert.match(html, /Confirme sua pré-venda/);
  assert.match(html, /Confirmar pré-venda/);
  assert.match(html, /Se você não solicitou esta inscrição/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1, "the email should render exactly one main heading");
  assert.equal((html.match(/<img\b/g) || []).length, 1, "the game cover should render once");
  assert.ok(html.indexOf("PRÉ-VENDA") < html.indexOf("<h1"));
  assert.ok(html.indexOf("<h1") < html.indexOf('src="https://cdn.example.test/game-cover.jpg"'));
});

test("email image URLs reject non-HTTP protocols", () => {
  const html = brandedEmail({
    eyebrow: "PRE-ORDER",
    heroImageUrl: "javascript:alert(1)",
    heading: "Confirm",
  });

  assert.doesNotMatch(html, /src="javascript:/);
  assert.equal((html.match(/<img\b/g) || []).length, 0);
});

test("the shared branded email template escapes text content", () => {
  const html = brandedEmail({
    heading: "Confirm",
    intro: "<script>alert(1)</script>",
  });

  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
