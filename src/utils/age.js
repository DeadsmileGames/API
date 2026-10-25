export function meetsMinimumAge(dateOfBirth, minimumAge = 13, now = new Date()) {
  if (typeof dateOfBirth !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return false;
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  const candidate = new Date(dateOfBirth + "T00:00:00.000Z");
  if (!Number.isFinite(candidate.getTime()) || candidate.toISOString().slice(0, 10) !== dateOfBirth) return false;
  if (dateOfBirth > now.toISOString().slice(0, 10)) return false;
  let age = now.getUTCFullYear() - year;
  const currentMonth = now.getUTCMonth() + 1;
  const currentDay = now.getUTCDate();
  if (currentMonth < month || (currentMonth === month && currentDay < day)) age -= 1;
  return age >= minimumAge;
}
