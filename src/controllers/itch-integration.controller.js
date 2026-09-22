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
<link rel="stylesheet" href="/itch-callback.css">
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
        <svg id="icon-cross" width="34" height="34" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2.6"
             stroke-linecap="round" stroke-linejoin="round" hidden>
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </div>
    </div>
    <h1 id="title"></h1>
    <p id="message"></p>

    <div class="loading-bar-wrap" id="progressWrap">
      <div class="loading-bar"><i></i></div>
    </div>
  </main>

<script src="/itch-callback.js" defer></script>
</body>
</html>
`;

export const callback = (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');
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