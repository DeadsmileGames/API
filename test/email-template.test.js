import test from "node:test";
import assert from "node:assert/strict";
import { brandedEmail } from "../src/services/email-template.js";

test("pre-order email template follows the Newswire editorial layout", () => {
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
    footer: "Mensagem automática",
  });

  assert.match(html, /<html lang="pt-BR">/);
  assert.match(html, /PRÉ-VENDA/);
  assert.match(html, /https:\/\/cdn\.example\.test\/game-cover\.jpg/);
  assert.match(html, /Confirme sua pré-venda/);
  assert.match(html, /Confirmar pré-venda/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1, "the email should render exactly one main heading");
  assert.equal((html.match(/<img\b/g) || []).length, 1, "the game cover should appear once");
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
