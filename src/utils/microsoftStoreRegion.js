import { resolveLocale } from "./publicErrors.js";

const REGIONS = Object.freeze({
  "pt-BR": Object.freeze({ market: "BR", locale: "pt-BR" }),
  en: Object.freeze({ market: "US", locale: "en-US" }),
  es: Object.freeze({ market: "ES", locale: "es-ES" }),
  fr: Object.freeze({ market: "FR", locale: "fr-FR" }),
  de: Object.freeze({ market: "DE", locale: "de-DE" }),
});

export function microsoftStoreRegion(language = "en") {
  return REGIONS[resolveLocale(language)] || REGIONS.en;
}
