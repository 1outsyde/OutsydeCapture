// One duration format across the app: "45 minutes", "1 hour", "6 hours 40 minutes".
// Durations are stored as whole minutes; these helpers only format and split them.

const toMinutes = (value: unknown): number => {
  const m = Math.round(Number(value));
  return Number.isFinite(m) && m > 0 ? m : 0;
};

// "" for anything that is not a positive number of minutes (0, null, undefined, NaN, negatives).
export const formatDuration = (minutes: number | null | undefined): string => {
  const m = toMinutes(minutes);
  if (m === 0) return "";
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (rest > 0) parts.push(`${rest} minute${rest === 1 ? "" : "s"}`);
  return parts.join(" ");
};

// Total minutes -> hours and minutes boxes (minutes 0-59). Invalid input is 0 and 0.
export const splitMinutes = (
  minutes: number | null | undefined,
): { hours: number; minutes: number } => {
  const m = toMinutes(minutes);
  return { hours: Math.floor(m / 60), minutes: m % 60 };
};

const toWhole = (value: number | string | null | undefined): number => {
  const n = typeof value === "string" ? parseInt(value, 10) : Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Hours and minutes boxes -> total minutes. An empty or invalid box counts as 0.
export const joinMinutes = (
  hours: number | string | null | undefined,
  minutes: number | string | null | undefined,
): number => toWhole(hours) * 60 + toWhole(minutes);
