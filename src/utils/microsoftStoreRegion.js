import { resolveLocale } from "./publicErrors.js";

const REGIONS = Object.freeze({
  "pt-BR": Object.freeze({ market: "BR", locale: "pt-BR" }),
  en: Object.freeze({ market: "US", locale: "en-US" }),
  es: Object.freeze({ market: "ES", locale: "es-ES" }),
});

export function microsoftStoreRegion(language = "en") {
  return REGIONS[resolveLocale(language)] || REGIONS.en;
}
