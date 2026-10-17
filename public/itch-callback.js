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
const returnLink = document.getElementById("returnLink");
let frontendOrigin = "";
try {
  frontendOrigin = new URL(returnLink.href).origin;
} catch {
  frontendOrigin = "";
}
history.replaceState({}, document.title, location.pathname);
function run() {
  if (
    !oauthState ||
    !accessToken ||
    !frontendOrigin ||
    !/^[A-Za-z0-9_-]{40,200}$/.test(oauthState) ||
    accessToken.length < 20 ||
    accessToken.length > 1000
  ) {
    throw { code: "ITCH_LINK_EXPIRED" };
  }
  const target = new URL("/itch-callback", frontendOrigin);
  target.hash = new URLSearchParams({ state: oauthState, access_token: accessToken }).toString();
  location.replace(target.toString());
}
try {
  run();
} catch (error) {
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
}
