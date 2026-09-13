import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import {
  beginItchConnection,
  completeItchConnection,
  disconnectItch,
  getItchStatus,
} from '../services/itch-integration.service.js';

const callbackPage = `
<!DOCTYPE html><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Deadsmile Games</title>
<style>
  @font-face {
    font-family: "Inter";
    font-style: normal;
    font-weight: 100 900;
    font-display: swap;
    src: url("https://deadsmilegames.vercel.app/assets/fonts/IV.ttf") format("truetype");
  }
  @font-face {
    font-family: "Space Grotesk";
    font-style: normal;
    font-weight: 300 700;
    font-display: swap;
    src: url("https://deadsmilegames.vercel.app/assets/fonts/SPV.ttf") format("truetype");
  }

  :root {
    font-family: Inter, system-ui, sans-serif;
    color: #f4f4f5;
    background: #0c0d12;
    font-synthesis: none;
    --bg: #0c0d12;
    --sidebar: #111219;
    --surface: #171922;
    --card: #181a22;
    --text: #f5f5f7;
    --border: #ffffff0b;
    --hover: #20232c;
    --active: #282b36;
    --input: #22252e;
    --input-focus: #292c36;
    --danger-bg: #2c1d20;
    --danger-text: #ffb1b5;
    --success: #8fd09f;
    --muted: #858894;
  }

  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  body {
    background: var(--bg);
    color: var(--text);
    display: grid;
    place-items: center;
    position: relative;
  }
  body::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 50% 35%, #171922 0%, #0c0d12 70%);
    pointer-events: none;
  }
  .callback-card {
    position: relative;
    width: min(430px, calc(100vw - 36px));
    padding: 34px;
    border-radius: 28px;
    background: var(--card);
    border: 1px solid var(--border);
    display: grid;
    justify-items: center;
    text-align: center;
    gap: 6px;
    animation: cardEnter 0.4s ease both;
  }
  .card-mark {
    position: relative;
    width: 74px;
    height: 74px;
    margin-bottom: 14px;
    display: grid;
    place-items: center;
  }

  .card-mark .badge {
    width: 74px;
    height: 74px;
    border-radius: 24px;
    display: grid;
    place-items: center;
    background: var(--input);
    color: var(--muted);
  }

  .card-mark[data-state="loading"] .badge {
    background: transparent;
    color: transparent;
  }

  .card-mark[data-state="done"] .badge {
    background: #1d3024;
    color: var(--success);
  }

  .card-mark[data-state="error"] .badge {
    background: var(--danger-bg);
    color: var(--danger-text);
  }
  .card-mark .spinner {
    position: absolute;
    inset: 0;
    margin: auto;
    width: 54px;
    height: 54px;
    animation: spin 0.85s linear infinite;
  }
  .card-mark .spinner circle {
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
  }
  .card-mark .spinner circle.track { stroke: #2c2f38; }
  .card-mark .spinner circle.head  { stroke: #f4f4f5; stroke-dasharray: 42 200; }

  .card-mark[data-state="done"] .spinner,
  .card-mark[data-state="error"] .spinner {
    display: none;
  }

  .card-mark .badge svg { display: block; }
  .callback-card h1 {
    font: 700 26px/1.15 "Space Grotesk", sans-serif;
    margin: 0;
    letter-spacing: -0.6px;
  }

  .callback-card p {
    color: #9497a1;
    font-size: 12px;
    line-height: 1.6;
    margin: 6px 0 0;
    max-width: 320px;
    min-height: 19px;
  }
  .loading-bar-wrap {
    width: 100%;
    margin-top: 22px;
    display: grid;
  }
  .loading-bar {
    height: 8px;
    width: 100%;
    background: var(--hover);
    border-radius: 999px;
    overflow: hidden;
    box-shadow: inset 0 0 0 1px #ffffff05;
  }
  .loading-bar i {
    display: block;
    height: 100%;
    width: 34%;
    background: linear-gradient(90deg, #d8d9dd, #fff);
    border-radius: 999px;
    animation: indeterminate 1.2s ease-in-out infinite;
  }

  .callback-card[data-state="done"] .loading-bar-wrap,
  .callback-card[data-state="error"] .loading-bar-wrap {
    display: none;
  }
  .callback-version {
    position: fixed;
    right: 20px;
    bottom: 16px;
    color: #6f727b;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    user-select: none;
    pointer-events: none;
    z-index: 3;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  @keyframes indeterminate {
    0%   { transform: translateX(-120%); }
    100% { transform: translateX(320%); }
  }

  @keyframes cardEnter {
    from { opacity: 0; transform: translateY(10px) scale(0.99); }
    to   { opacity: 1; transform: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
</style>
</head>
<body>
  <main class="callback-card" data-state="loading" id="card">
    <div class="card-mark" data-state="loading" id="mark">
      <svg class="spinner" viewBox="0 0 54 54" aria-hidden="true">
        <circle class="track" cx="27" cy="27" r="22"/>
        <circle class="head"  cx="27" cy="27" r="22"/>
      </svg>
      <div class="badge" id="badge">
        <svg id="icon-check" width="34" height="34" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2.6"
             stroke-linecap="round" stroke-linejoin="round" hidden>
          <path d="M20 6 9 17l-5-5"/>
        </svg>
      </div>
    </div>
    <h1 id="title"></h1>
    <p id="message"></p>

    <div class="loading-bar-wrap" id="progressWrap">
      <div class="loading-bar"><i></i></div>
    </div>
  </main>

  <div class="callback-version">v1.0.0</div>

<script>
const copy = {
  en: {
    working: "Connecting your itch.io account…",
    done: "Account connected",
    doneText: "You can return to Deadsmile Games.",
    error: "Connection not completed",
    errorText: "Return to Deadsmile Games and try again."
  },
  "pt-BR": {
    working: "Conectando sua conta itch.io…",
    done: "Conta conectada",
    doneText: "Você já pode voltar para a Deadsmile Games.",
    error: "Não foi possível conectar",
    errorText: "Volte para a Deadsmile Games e tente novamente."
  },
  es: {
    working: "Conectando tu cuenta de itch.io…",
    done: "Cuenta conectada",
    doneText: "Ya puedes volver a Deadsmile Games.",
    error: "No se pudo conectar",
    errorText: "Vuelve a Deadsmile Games e inténtalo de nuevo."
  }
};

const card         = document.getElementById("card");
const mark         = document.getElementById("mark");
const iconCheck    = document.getElementById("icon-check");
const title        = document.getElementById("title");
const message      = document.getElementById("message");
const progressWrap = document.getElementById("progressWrap");

function applyState(state, strings) {
  card.dataset.state = state;
  mark.dataset.state = state;

  iconCheck.hidden = state !== "done";
  progressWrap.hidden = state !== "loading";
  title.textContent   = state === "done"  ? strings.done
                      : state === "error" ? strings.error
                      : strings.working;
  message.textContent = state === "done"  ? strings.doneText
                      : state === "error" ? strings.errorText
                      : "";
}

applyState("loading", copy.en);

const params      = new URLSearchParams(location.hash.slice(1));
const state       = params.get("state");
const accessToken = params.get("access_token");
history.replaceState({}, document.title, location.pathname);

async function run() {
  if (!state || !accessToken) throw new Error("missing params");

  const csrfResponse = await fetch("/api/csrf", { credentials: "include" });
  const csrfPayload  = await csrfResponse.json();

  const response = await fetch("/api/integrations/itch/complete", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfPayload.data.token
    },
    body: JSON.stringify({ state, accessToken })
  });

  const payload = await response.json();
  if (!response.ok) throw new Error("request failed");

  const locale  = payload.data.locale in copy ? payload.data.locale : "en";
  const strings = copy[locale];

  applyState("done", strings);

  if (payload.data.returnUrl) {
    setTimeout(() => location.replace(payload.data.returnUrl), 900);
  }
}

run().catch(() => {
  applyState("error", copy.en);
});
</script>
</body>
</html>
`;

export const callback = (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('html').send(callbackPage);
};

export const status = asyncHandler(async (req, res) => {
  sendSuccess(res, await getItchStatus(req.session.userId));
});

export const connect = asyncHandler(async (req, res) => {
  sendSuccess(res, await beginItchConnection(req.session.userId, req.body), 201);
});

export const complete = asyncHandler(async (req, res) => {
  sendSuccess(res, await completeItchConnection(req.body));
});

export const disconnect = asyncHandler(async (req, res) => {
  sendSuccess(res, await disconnectItch(req.session.userId));
});
