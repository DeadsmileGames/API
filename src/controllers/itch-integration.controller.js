import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import {
  beginItchConnection,
  completeItchConnection,
  disconnectItch,
  getItchStatus,
} from '../services/itch-integration.service.js';

const callbackPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Deadsmile Games</title><style>html{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#090909;color:#f5f5f5;font:15px Inter,system-ui,sans-serif}.card{width:min(420px,calc(100% - 40px));padding:36px;border:1px solid #262626;border-radius:22px;background:#111;text-align:center;box-sizing:border-box}.mark{width:48px;height:48px;margin:0 auto 22px;border:2px solid #3a3a3a;border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite}.done .mark{border:0}.done .mark:after{content:'✓';display:grid;place-items:center;width:48px;height:48px;border-radius:50%;background:#f3f3f3;color:#090909;font-size:24px;font-weight:800}.error .mark{display:none}h1{font-size:22px;margin:0 0 10px}p{color:#9b9b9b;line-height:1.55;margin:0}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><main class="card"><div class="mark"></div><h1 id="title"></h1><p id="message"></p></main><script>const copy={en:{working:'Connecting your itch.io account…',done:'Account connected',doneText:'You can return to Deadsmile Games.',error:'Connection not completed',errorText:'Return to Deadsmile Games and try again.'},'pt-BR':{working:'Conectando sua conta itch.io…',done:'Conta conectada',doneText:'Você já pode voltar para a Deadsmile Games.',error:'Não foi possível conectar',errorText:'Volte para a Deadsmile Games e tente novamente.'},es:{working:'Conectando tu cuenta de itch.io…',done:'Cuenta conectada',doneText:'Ya puedes volver a Deadsmile Games.',error:'No se pudo conectar',errorText:'Vuelve a Deadsmile Games e inténtalo de nuevo.'}};const title=document.getElementById('title');const message=document.getElementById('message');const card=document.querySelector('.card');title.textContent=copy.en.working;const params=new URLSearchParams(location.hash.slice(1));const state=params.get('state');const accessToken=params.get('access_token');history.replaceState({},document.title,location.pathname);async function run(){if(!state||!accessToken)throw new Error();const csrfResponse=await fetch('/api/csrf',{credentials:'include'});const csrfPayload=await csrfResponse.json();const response=await fetch('/api/integrations/itch/complete',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfPayload.data.token},body:JSON.stringify({state,accessToken})});const payload=await response.json();if(!response.ok)throw new Error();const locale=payload.data.locale in copy?payload.data.locale:'en';const strings=copy[locale];card.classList.add('done');title.textContent=strings.done;message.textContent=strings.doneText;if(payload.data.returnUrl)setTimeout(()=>location.replace(payload.data.returnUrl),500)}run().catch(()=>{card.classList.add('error');title.textContent=copy.en.error;message.textContent=copy.en.errorText})</script></body></html>`;

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
