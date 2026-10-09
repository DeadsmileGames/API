import { resolveLocale } from '../utils/publicErrors.js';
import { escapeHtml } from '../utils/html.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import {
  beginItchConnection,
  completeItchConnection,
  disconnectItch,
  getItchStatus,
} from '../services/itch-integration.service.js';

const callbackPage = `
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Deadsmile Games</title>
<link rel="stylesheet" href="/styles/global.css">
</head>
<body>
  <main class="newsletter-action page-section">
    <section class="newsletter-action__card" data-state="loading" id="card" role="status" aria-live="polite" aria-busy="true">
    <div class="newsletter-action__icon newsletter-action__icon--loading" data-state="loading" id="mark" aria-hidden="true">
        <svg id="icon-check" width="34" height="34" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2.6"
             stroke-linecap="round" stroke-linejoin="round" hidden>
          <path d="M20 6 9 17l-5-5"/>
        </svg>
        <svg id="icon-cross" width="34" height="34" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2.6"
             stroke-linecap="round" stroke-linejoin="round" hidden>
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
    </div>
    <h1 id="title"></h1>
    <p id="message"></p>

    <div class="save-progress" id="progressWrap">
      <div class="save-progress__bar"></div>
    </div>
    <a class="btn btn--secondary" id="returnLink" href="__RETURN_URL__" hidden></a>
    </section>
  </main>

<script src="/error-catalog.js" defer></script>
<script src="/itch-callback.js" defer></script>
</body>
</html>
`;

export const callback = (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
  res.type('html').send(callbackPage.replace('__RETURN_URL__', escapeHtml(`${env.frontendUrl}/account#games`)));
};

export const status = asyncHandler(async (req, res) => {
  sendSuccess(res, await getItchStatus(req.session.userId));
});

export const connect = asyncHandler(async (req, res) => {
  sendSuccess(res, await beginItchConnection(req.session.userId, req.body), 201);
});

export const complete = asyncHandler(async (req, res) => {
  sendSuccess(res, await completeItchConnection(req.body, (locale) => { res.locals.locale = resolveLocale(locale); res.set('Content-Language', res.locals.locale); }));
});

export const disconnect = asyncHandler(async (req, res) => {
  sendSuccess(res, await disconnectItch(req.session.userId));
});
