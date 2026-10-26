const messages = {
  en: {
    newFromStudio: "New from Deadsmile Games",
    newContentAvailable: "New content is available.",
    viewOnSite: "View on Deadsmile Games",
    newsletterNotice: "You received this because you confirmed the Deadsmile Games newsletter.",
    unsubscribe: "Unsubscribe",
  },
  "pt-BR": {
    newFromStudio: "Novidades da Deadsmile Games",
    newContentAvailable: "Há conteúdo novo disponível.",
    viewOnSite: "Ver no site da Deadsmile Games",
    newsletterNotice: "Você recebeu esta mensagem porque confirmou a inscrição na newsletter da Deadsmile Games.",
    unsubscribe: "Cancelar inscrição",
  },
  es: {
    newFromStudio: "Novedades de Deadsmile Games",
    newContentAvailable: "Hay contenido nuevo disponible.",
    viewOnSite: "Ver en Deadsmile Games",
    newsletterNotice: "Recibiste este mensaje porque confirmaste tu suscripción al boletín de Deadsmile Games.",
    unsubscribe: "Cancelar suscripción",
  },
};

const keys = Object.keys(messages.en);

export function notificationCopyFor(locale = "en") {
  const requested = Object.hasOwn(messages, locale) ? locale : "en";
  return messages[requested];
}

export function notificationCopyLocales() {
  return Object.keys(messages);
}

export function notificationCopyKeys() {
  return [...keys];
}

export function hasCompleteNotificationCopy() {
  return Object.values(messages).every(
    (catalog) =>
      JSON.stringify(Object.keys(catalog).sort()) ===
      JSON.stringify([...keys].sort()) &&
      Object.values(catalog).every(
        (value) => typeof value === "string" && value.trim().length > 0,
      ),
  );
}
