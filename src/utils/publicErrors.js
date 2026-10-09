import catalog from './errorCatalog.json' with { type: 'json' };

export function resolveLocale(value) {
  const requested = String(value || 'en').split(',').map((part) => {
    const [tag, quality] = part.trim().split(';q=');
    return { tag: tag.toLowerCase(), quality: quality === undefined ? 1 : Number(quality) };
  }).filter((item) => item.quality > 0).sort((a, b) => b.quality - a.quality);
  for (const { tag } of requested) {
    if (tag === 'pt' || tag.startsWith('pt-')) return 'pt-BR';
    if (tag === 'es' || tag.startsWith('es-')) return 'es';
    if (tag === 'en' || tag.startsWith('en-')) return 'en';
  }
  return 'en';
}

export function publicErrorMessage(code, status, locale = 'en') {
  const messages = catalog[resolveLocale(locale)];
  const fallback = { 400: 'VALIDATION_ERROR', 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT', 413: 'PAYLOAD_TOO_LARGE', 429: 'RATE_LIMITED', 502: 'SERVICE_UNAVAILABLE', 503: 'SERVICE_UNAVAILABLE' };
  return messages[String(code || '').toUpperCase()] || messages[fallback[status] || 'INTERNAL_ERROR'];
}

export function errorCatalog(locale) { return catalog[resolveLocale(locale)]; }
