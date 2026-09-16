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
const iconCross    = document.getElementById("icon-cross");
const title        = document.getElementById("title");
const message      = document.getElementById("message");
const progressWrap = document.getElementById("progressWrap");

function applyState(state, strings) {
  card.dataset.state = state;
  mark.dataset.state = state;

  iconCheck.toggleAttribute("hidden", state !== "done");
  iconCross.toggleAttribute("hidden", state !== "error");
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
