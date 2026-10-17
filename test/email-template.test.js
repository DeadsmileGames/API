import test from "node:test";
import assert from "node:assert/strict";
import { brandedEmail } from "../src/services/email-template.js";

test("pre-order email uses the same branded HTML structure as newsletter subscription", () => {
  const html = brandedEmail({
    lang: "pt-BR",
    preheader: "Confirme sua inscrição",
    heading: "Confirme sua pré-venda",
    intro: "Recebemos seu pedido para participar. O link expira em 24 horas.",
    actionLabel: "Confirmar pré-venda",
    actionUrl: "https://deadsmilegames.example/games/sample/preorder/confirm/token",
    footer: "Se você não solicitou esta inscrição, ignore esta mensagem.",
  });

  assert.match(html, /<html lang="pt-BR">/);
  assert.match(html, /background:#181818;border:1px solid #3d3d3d;border-radius:14px/);
  assert.match(html, /DEADSMILE <span style="color:#ff3b3b">GAMES<\/span>/);
  assert.match(html, /Confirme sua pré-venda/);
  assert.match(html, /Confirmar pré-venda/);
  assert.match(html, /Se você não solicitou esta inscrição/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1, "the email should render exactly one main heading");
  assert.equal((html.match(/<img\b/g) || []).length, 0, "the email layout should not add a different game-cover block");
});

test("the shared branded email template escapes text content", () => {
  const html = brandedEmail({
    heading: "Confirm",
    intro: "<script>alert(1)</script>",
  });

  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
