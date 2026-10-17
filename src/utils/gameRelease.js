const RELEASE_TIME_ZONE = "America/Sao_Paulo";

function calendarDateInTimeZone(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: RELEASE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function releaseDateOnly(value) {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return calendarDateInTimeZone(value);
  }

  return null;
}

export function hasReleaseDateArrived(releaseDate, now = new Date()) {
  const targetDate = releaseDateOnly(releaseDate);
  const today = calendarDateInTimeZone(now);
  return Boolean(targetDate && today && targetDate <= today);
}

export function getEffectiveGameStatus(game, now = new Date()) {
  if (
    game?.status === "in_development" &&
    hasReleaseDateArrived(game.release_date ?? game.releaseDate, now)
  ) {
    return "released";
  }

  return game?.status;
}


export function isGameDownloadUnlocked(game, now = new Date()) {
  return getEffectiveGameStatus(game, now) === "released";
}
