export function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isSafeRelativePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return false;
  }
  try {
    const base = 'https://deadsmile.invalid';
    const url = new URL(value, base);
    return url.origin === base && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isItchHttpsUrl(value) {
  if (!isHttpsUrl(value)) return false;
  const url = new URL(value);
  return url.hostname === 'itch.io' || url.hostname.endsWith('.itch.io');
}

export function safeAbsoluteUrl(value, base) {
  try {
    const url = new URL(value, base);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}
