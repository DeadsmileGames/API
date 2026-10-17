const copy = {
  en: {
    working: "Connecting your itch.io account…",
    done: "Account connected",
    doneText: "You can return to Deadsmile Games.",
    error: "Connection not completed",
    back: "Return to account",
  },
  "pt-BR": {
    working: "Conectando sua conta itch.io…",
    done: "Conta conectada",
    doneText: "Você pode voltar para Deadsmile Games.",
    error: "Conexão não concluída",
    back: "Voltar para a conta",
  },
  es: {
    working: "Conectando tu cuenta de itch.io…",
    done: "Cuenta conectada",
    doneText: "Puedes volver a Deadsmile Games.",
    error: "Conexión no completada",
    back: "Volver a la cuenta",
  },
};
let locale = /^pt(?:-|$)/i.test(navigator.language)
  ? "pt-BR"
  : /^es(?:-|$)/i.test(navigator.language)
    ? "es"
    : "en";
let strings = copy[locale];
let messages = window.deadsmileErrors[locale];
document.documentElement.lang = locale;
function state(value, message) {
  document.getElementById("card").dataset.state = value;
  document.getElementById("card").setAttribute("aria-busy", String(value === "loading"));
  document
    .getElementById("card")
    .setAttribute("role", value === "error" ? "alert" : "status");
  document.getElementById("mark").dataset.state = value;
  document.getElementById("mark").className =
    `newsletter-action__icon newsletter-action__icon--${value === "done" ? "success" : value}`;
  document.getElementById("icon-check")?.toggleAttribute("hidden", value !== "done");
  document.getElementById("icon-cross")?.toggleAttribute("hidden", value !== "error");
  document.getElementById("progressWrap").hidden = value !== "loading";
  document.getElementById("title").textContent =
    value === "done" ? strings.done : value === "error" ? strings.error : strings.working;
  document.getElementById("message").textContent =
    message || (value === "done" ? strings.doneText : "");
  document.getElementById("returnLink").hidden = value === "loading";
  document.getElementById("returnLink").textContent = strings.back;
}
state("loading");
const params = new URLSearchParams(location.hash.slice(1));
const oauthState = params.get("state");
const accessToken = params.get("access_token");
history.replaceState({}, document.title, location.pathname);

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw { code: "INVALID_RESPONSE" };
    }
    if (!response.ok || payload?.success !== true || !payload?.data) {
      throw payload?.error || { code: "INTERNAL_ERROR" };
    }
    return payload.data;
  } catch (error) {
    if (error?.name === "AbortError") throw { code: "REQUEST_TIMEOUT" };
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function run() {
  if (
    !oauthState ||
    !accessToken ||
    !/^[A-Za-z0-9_-]{40,200}$/.test(oauthState) ||
    accessToken.length < 20 ||
    accessToken.length > 1000
  ) {
    throw { code: "ITCH_LINK_EXPIRED" };
  }

  const csrf = await request("/api/csrf", {
    credentials: "include",
    headers: { "Accept-Language": locale },
  });
  if (typeof csrf.token !== "string" || !csrf.token) throw { code: "CSRF_INIT_FAILED" };

  const flow = await request("/api/integrations/itch/flow", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrf.token,
      "Accept-Language": locale,
    },
    body: JSON.stringify({ state: oauthState }),
  });
  if (flow.client !== "site" || typeof flow.frontendOrigin !== "string") {
    throw { code: "ITCH_LINK_EXPIRED" };
  }
  const origin = new URL(flow.frontendOrigin);
  const localHttp =
    origin.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  let allowedOrigins;
  try {
    const configured = document.querySelector('meta[name="deadsmile-frontend-origins"]')?.content;
    allowedOrigins = JSON.parse(configured || "null");
  } catch {
    throw { code: "ITCH_LINK_EXPIRED" };
  }
  if (
    !Array.isArray(allowedOrigins) ||
    !allowedOrigins.includes(origin.origin) ||
    (origin.protocol !== "https:" && !localHttp) ||
    origin.origin !== flow.frontendOrigin
  ) {
    throw { code: "ITCH_LINK_EXPIRED" };
  }

  const target = new URL("/itch-callback", origin);
  target.hash = new URLSearchParams({
    state: oauthState,
    access_token: accessToken,
  }).toString();
  location.replace(target.toString());
}

run().catch((error) => {
  locale = error.locale || locale;
  strings = copy[locale] || copy.en;
  messages = window.deadsmileErrors[locale] || window.deadsmileErrors.en;
  document.documentElement.lang = locale;
  state(
    "error",
    error.code && typeof error.message === "string"
      ? error.message
      : messages[error.code] || messages.NETWORK_ERROR,
  );
});
