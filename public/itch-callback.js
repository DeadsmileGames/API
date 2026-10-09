const copy = {
  en: { working: 'Connecting your itch.io account…', done: 'Account connected', doneText: 'You can return to Deadsmile Games.', error: 'Connection not completed' },
  'pt-BR': { working: 'Conectando sua conta itch.io…', done: 'Conta conectada', doneText: 'Você pode voltar para Deadsmile Games.', error: 'Conexão não concluída' },
  es: { working: 'Conectando tu cuenta de itch.io…', done: 'Cuenta conectada', doneText: 'Puedes volver a Deadsmile Games.', error: 'Conexión no completada' },
};
let locale = /^pt(?:-|$)/i.test(navigator.language) ? 'pt-BR' : /^es(?:-|$)/i.test(navigator.language) ? 'es' : 'en';
let strings = copy[locale];
let messages = window.deadsmileErrors[locale];
function state(value, message) {
  document.getElementById('card').dataset.state = value;
  document.getElementById('mark').dataset.state = value;
  document.getElementById('icon-check')?.toggleAttribute('hidden', value !== 'done');
  document.getElementById('icon-cross')?.toggleAttribute('hidden', value !== 'error');
  document.getElementById('progressWrap').hidden = value !== 'loading';
  document.getElementById('title').textContent = value === 'done' ? strings.done : value === 'error' ? strings.error : strings.working;
  document.getElementById('message').textContent = message || (value === 'done' ? strings.doneText : '');
}
state('loading');
const params = new URLSearchParams(location.hash.slice(1));
const oauthState = params.get('state');
const accessToken = params.get('access_token');
history.replaceState({}, document.title, location.pathname);
async function run() {
  if (!oauthState || !accessToken) throw { code: 'ITCH_LINK_EXPIRED' };
  const csrf = await fetch('/api/csrf', { credentials: 'include', headers: { 'Accept-Language': locale } });
  const csrfPayload = await csrf.json();
  if (!csrf.ok || !csrfPayload?.data?.token) throw { code: 'CSRF_INIT_FAILED', message: csrfPayload?.error?.message };
  const response = await fetch('/api/integrations/itch/complete', { method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfPayload.data.token, 'Accept-Language': locale },
    body: JSON.stringify({ state: oauthState, accessToken }) });
  const payload = await response.json();
  if (!response.ok) throw payload.error || { code: 'INTERNAL_ERROR' };
  locale = payload.data?.locale || locale; strings = copy[locale] || copy.en; messages = window.deadsmileErrors[locale] || window.deadsmileErrors.en; document.documentElement.lang = locale;
  state('done');
  if (payload.data?.returnUrl) {
    const url = new URL(payload.data.returnUrl);
    if (url.protocol === 'https:' && !url.username && !url.password) setTimeout(() => location.replace(url.toString()), 900);
  }
}
run().catch((error) => { locale = error.locale || locale; strings = copy[locale] || copy.en; messages = window.deadsmileErrors[locale] || window.deadsmileErrors.en; document.documentElement.lang = locale; state('error', messages[error.code] || messages.NETWORK_ERROR); });
