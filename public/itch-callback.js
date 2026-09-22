const copy = {
  en: {
    working: "Connecting your itch.io account…",
    done: "Account connected",
    doneText: "You can return to Deadsmile Games.",
    error: "Connection not completed",
    errorText: "Return to Deadsmile Games and try again.",

    errors: {
      MISSING_PARAMS: {
        title: "Link not valid",
        text: "This link is missing required information. Return to Deadsmile Games and start the connection again.",
      },

      ITCH_LINK_EXPIRED: {
        title: "Link expired",
        text: "This connection request has expired. Return to Deadsmile Games and start again — the link is only valid for 10 minutes.",
      },

      ITCH_SCOPE_MISSING: {
        title: "Access not granted",
        text: "Deadsmile Games needs permission to read your itch.io profile and library. Try again and allow all requested permissions.",
      },

      ITCH_ACCOUNT_IN_USE: {
        title: "Account already connected",
        text: "This itch.io account is already linked to a different Deadsmile Games account. Disconnect it there first, then try again.",
      },

      ITCH_PROFILE_INVALID: {
        title: "Profile not verified",
        text: "Your itch.io profile could not be verified. Make sure your itch.io account is active and try again.",
      },

      ITCH_UNAVAILABLE: {
        title: "itch.io unavailable",
        text: "itch.io is not responding right now. Wait a few minutes and try again.",
      },

      ITCH_NOT_CONFIGURED: {
        title: "Connection unavailable",
        text: "The itch.io connection is temporarily disabled. Try again later or contact support.",
      },

      RATE_LIMITED: {
        title: "Too many attempts",
        text: "You've made too many requests. Wait a few minutes before trying again.",
      },

      CSRF_VALIDATION_FAILED: {
        title: "Session expired",
        text: "Your session expired during the connection. Return to Deadsmile Games, sign in again, and retry.",
      },
      CSRF_INIT_FAILED: {
        title: "Session error",
        text: "A session error occurred. Refresh the page and try again.",
      },

      ITCH_RECONNECT_REQUIRED: {
        title: "itch.io token expired",
        text: "Your itch.io session expired before the connection could finish. Return to Deadsmile Games and start the connection again.",
      },

      SERVICE_UNAVAILABLE: {
        title: "Service temporarily unavailable",
        text: "Deadsmile Games is experiencing an issue right now. Wait a moment and try again.",
      },

      INTERNAL_ERROR: {
        title: "Unexpected error",
        text: "Something went wrong on our end. Return to Deadsmile Games and try again. If the problem persists, contact support.",
      },

      INVALID_JSON: {
        title: "Request error",
        text: "The request could not be read. Return to Deadsmile Games and try again.",
      },
      PAYLOAD_TOO_LARGE: {
        title: "Request too large",
        text: "The request was too large to process. Return to Deadsmile Games and try again.",
      },

      VALIDATION_ERROR: {
        title: "Invalid request",
        text: "The connection request contained invalid data. Return to Deadsmile Games and try again.",
      },

      NETWORK_ERROR: {
        title: "No connection",
        text: "Could not reach Deadsmile Games. Check your internet connection and try again.",
      },
    },
  },

  "pt-BR": {
    working: "Conectando sua conta itch.io…",
    done: "Conta conectada",
    doneText: "Você já pode voltar para a Deadsmile Games.",
    error: "Não foi possível conectar",
    errorText: "Volte para a Deadsmile Games e tente novamente.",

    errors: {
      MISSING_PARAMS: {
        title: "Link inválido",
        text: "Este link não contém as informações necessárias. Volte para a Deadsmile Games e inicie a conexão novamente.",
      },
      ITCH_LINK_EXPIRED: {
        title: "Link expirado",
        text: "Esta solicitação de conexão expirou. Volte para a Deadsmile Games e tente novamente — o link é válido por apenas 10 minutos.",
      },
      ITCH_SCOPE_MISSING: {
        title: "Acesso não concedido",
        text: "A Deadsmile Games precisa de permissão para ler seu perfil e biblioteca do itch.io. Tente novamente e autorize todas as permissões solicitadas.",
      },
      ITCH_ACCOUNT_IN_USE: {
        title: "Conta já conectada",
        text: "Esta conta itch.io já está vinculada a outra conta da Deadsmile Games. Desconecte-a primeiro e tente novamente.",
      },
      ITCH_PROFILE_INVALID: {
        title: "Perfil não verificado",
        text: "Seu perfil itch.io não pôde ser verificado. Certifique-se de que sua conta está ativa e tente novamente.",
      },
      ITCH_UNAVAILABLE: {
        title: "itch.io indisponível",
        text: "O itch.io não está respondendo no momento. Aguarde alguns minutos e tente novamente.",
      },
      ITCH_NOT_CONFIGURED: {
        title: "Conexão indisponível",
        text: "A integração com o itch.io está temporariamente desativada. Tente mais tarde ou entre em contato com o suporte.",
      },
      RATE_LIMITED: {
        title: "Muitas tentativas",
        text: "Você fez muitas solicitações. Aguarde alguns minutos antes de tentar novamente.",
      },
      CSRF_VALIDATION_FAILED: {
        title: "Sessão expirada",
        text: "Sua sessão expirou durante a conexão. Volte para a Deadsmile Games, faça login novamente e tente outra vez.",
      },
      CSRF_INIT_FAILED: {
        title: "Erro de sessão",
        text: "Ocorreu um erro de sessão. Atualize a página e tente novamente.",
      },
      ITCH_RECONNECT_REQUIRED: {
        title: "Token itch.io expirado",
        text: "Sua sessão itch.io expirou antes de concluir a conexão. Volte para a Deadsmile Games e inicie a conexão novamente.",
      },
      SERVICE_UNAVAILABLE: {
        title: "Serviço temporariamente indisponível",
        text: "A Deadsmile Games está com uma instabilidade no momento. Aguarde um instante e tente novamente.",
      },
      INTERNAL_ERROR: {
        title: "Erro inesperado",
        text: "Algo deu errado do nosso lado. Volte para a Deadsmile Games e tente novamente. Se o problema persistir, entre em contato com o suporte.",
      },
      INVALID_JSON: {
        title: "Erro na requisição",
        text: "A solicitação não pôde ser lida. Volte para a Deadsmile Games e tente novamente.",
      },
      PAYLOAD_TOO_LARGE: {
        title: "Requisição muito grande",
        text: "A solicitação era grande demais para ser processada. Volte para a Deadsmile Games e tente novamente.",
      },
      VALIDATION_ERROR: {
        title: "Solicitação inválida",
        text: "A solicitação de conexão continha dados inválidos. Volte para a Deadsmile Games e tente novamente.",
      },
      NETWORK_ERROR: {
        title: "Sem conexão",
        text: "Não foi possível alcançar a Deadsmile Games. Verifique sua conexão com a internet e tente novamente.",
      },
    },
  },

  es: {
    working: "Conectando tu cuenta de itch.io…",
    done: "Cuenta conectada",
    doneText: "Ya puedes volver a Deadsmile Games.",
    error: "No se pudo conectar",
    errorText: "Vuelve a Deadsmile Games e inténtalo de nuevo.",

    errors: {
      MISSING_PARAMS: {
        title: "Enlace no válido",
        text: "Este enlace no contiene la información necesaria. Vuelve a Deadsmile Games e inicia la conexión de nuevo.",
      },
      ITCH_LINK_EXPIRED: {
        title: "Enlace caducado",
        text: "Esta solicitud de conexión ha caducado. Vuelve a Deadsmile Games e inténtalo de nuevo — el enlace solo es válido 10 minutos.",
      },
      ITCH_SCOPE_MISSING: {
        title: "Acceso no concedido",
        text: "Deadsmile Games necesita permiso para leer tu perfil y biblioteca de itch.io. Inténtalo de nuevo y acepta todos los permisos solicitados.",
      },
      ITCH_ACCOUNT_IN_USE: {
        title: "Cuenta ya conectada",
        text: "Esta cuenta de itch.io ya está vinculada a otra cuenta de Deadsmile Games. Desconéctala primero e inténtalo de nuevo.",
      },
      ITCH_PROFILE_INVALID: {
        title: "Perfil no verificado",
        text: "No se pudo verificar tu perfil de itch.io. Asegúrate de que tu cuenta está activa e inténtalo de nuevo.",
      },
      ITCH_UNAVAILABLE: {
        title: "itch.io no disponible",
        text: "itch.io no responde en este momento. Espera unos minutos e inténtalo de nuevo.",
      },
      ITCH_NOT_CONFIGURED: {
        title: "Conexión no disponible",
        text: "La integración con itch.io está temporalmente desactivada. Inténtalo más tarde o contacta con soporte.",
      },
      RATE_LIMITED: {
        title: "Demasiados intentos",
        text: "Has realizado demasiadas solicitudes. Espera unos minutos antes de intentarlo de nuevo.",
      },
      CSRF_VALIDATION_FAILED: {
        title: "Sesión caducada",
        text: "Tu sesión caducó durante la conexión. Vuelve a Deadsmile Games, inicia sesión de nuevo e inténtalo otra vez.",
      },
      CSRF_INIT_FAILED: {
        title: "Error de sesión",
        text: "Se produjo un error de sesión. Actualiza la página e inténtalo de nuevo.",
      },
      ITCH_RECONNECT_REQUIRED: {
        title: "Token de itch.io caducado",
        text: "Tu sesión de itch.io expiró antes de que la conexión pudiera completarse. Vuelve a Deadsmile Games e inicia la conexión de nuevo.",
      },
      SERVICE_UNAVAILABLE: {
        title: "Servicio temporalmente no disponible",
        text: "Deadsmile Games tiene una incidencia en este momento. Espera un momento e inténtalo de nuevo.",
      },
      INTERNAL_ERROR: {
        title: "Error inesperado",
        text: "Algo salió mal de nuestro lado. Vuelve a Deadsmile Games e inténtalo de nuevo. Si el problema persiste, contacta con soporte.",
      },
      INVALID_JSON: {
        title: "Error en la solicitud",
        text: "La solicitud no pudo leerse. Vuelve a Deadsmile Games e inténtalo de nuevo.",
      },
      PAYLOAD_TOO_LARGE: {
        title: "Solicitud demasiado grande",
        text: "La solicitud era demasiado grande para procesarse. Vuelve a Deadsmile Games e inténtalo de nuevo.",
      },
      VALIDATION_ERROR: {
        title: "Solicitud no válida",
        text: "La solicitud de conexión contenía datos no válidos. Vuelve a Deadsmile Games e inténtalo de nuevo.",
      },
      NETWORK_ERROR: {
        title: "Sin conexión",
        text: "No se pudo contactar con Deadsmile Games. Comprueba tu conexión a internet e inténtalo de nuevo.",
      },
    },
  },
};

const card = document.getElementById("card");
const mark = document.getElementById("mark");
const iconCheck = document.getElementById("icon-check");
const iconCross = document.getElementById("icon-cross");
const title = document.getElementById("title");
const message = document.getElementById("message");
const progressWrap = document.getElementById("progressWrap");

function detectLocale() {
  const lang = (navigator.language || "en").toLowerCase();
  if (lang.startsWith("pt")) return "pt-BR";
  if (lang.startsWith("es")) return "es";
  return "en";
}

let currentLocale = detectLocale();

function applyState(state, strings, errorCode) {
  card.dataset.state = state;
  mark.dataset.state = state;

  iconCheck.toggleAttribute("hidden", state !== "done");
  iconCross.toggleAttribute("hidden", state !== "error");
  progressWrap.hidden = state !== "loading";

  if (state === "done") {
    title.textContent = strings.done;
    message.textContent = strings.doneText;
    return;
  }

  if (state === "error") {
    const specific = errorCode && strings.errors?.[errorCode];
    title.textContent = specific ? specific.title : strings.error;
    message.textContent = specific ? specific.text : strings.errorText;
    return;
  }

  title.textContent = strings.working;
  message.textContent = "";
}

applyState("loading", copy[currentLocale]);

const params = new URLSearchParams(location.hash.slice(1));
const oauthState = params.get("state");
const accessToken = params.get("access_token");
history.replaceState({}, document.title, location.pathname);

async function run() {
  if (!oauthState || !accessToken) {
    throw { code: "MISSING_PARAMS" };
  }

  let csrfPayload;
  try {
    const csrfRes = await fetch("/api/csrf", { credentials: "include" });
    csrfPayload = await csrfRes.json();
    if (!csrfRes.ok || !csrfPayload?.data?.token) {
      throw { code: "CSRF_INIT_FAILED" };
    }
  } catch (err) {
    if (err instanceof TypeError) throw { code: "NETWORK_ERROR" };
    throw err;
  }

  let response, payload;
  try {
    response = await fetch("/api/integrations/itch/complete", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfPayload.data.token,
      },
      body: JSON.stringify({ state: oauthState, accessToken }),
    });
    payload = await response.json();
  } catch {
    throw { code: "NETWORK_ERROR" };
  }

  if (!response.ok) {
    const code = payload?.error?.code || null;
    throw { code };
  }

  const serverLocale = payload.data?.locale;
  const locale = serverLocale in copy ? serverLocale : currentLocale;
  const strings = copy[locale];

  applyState("done", strings);

  if (payload.data?.returnUrl) {
    setTimeout(() => location.replace(payload.data.returnUrl), 900);
  }
}

run().catch((err) => {
  const strings = copy[currentLocale];

  applyState("error", strings, err?.code ?? null);
});
