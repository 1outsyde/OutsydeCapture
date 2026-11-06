// Booking redesign step 2 (2026-11-05): pure helpers for the Choose a Time
// screen. No React, no network, so they can be unit tested.

export type SlotLike = { startTime: string; status?: string };
export type DayStatus = "available" | "partial" | "unavailable" | "past" | "unknown";

const pad = (n: number) => String(n).padStart(2, "0");

/** "HH:MM" → minutes after midnight (NaN when malformed). */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

/** Local calendar date as YYYY-MM-DD. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM-DD → local Date at midnight. */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** YYYY-MM of an ISO date. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/** The `count` days shown in the week row, starting at `start`. */
export function weekWindow(start: string, count = 6): string[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

/** The months a set of days touches, in order, without repeats. */
export function monthsTouched(days: string[]): string[] {
  const out: string[] = [];
  for (const d of days) {
    const m = monthOf(d);
    if (!out.includes(m)) out.push(m);
  }
  return out;
}

/**
 * Where the week row starts so `selected` is visible: two days before it,
 * never before `today`.
 */
export function weekStartFor(selected: string, today: string): string {
  const candidate = addDays(selected, -2);
  return candidate < today ? today : candidate;
}

/** Earlier arrow: one row back, never before today. */
export function previousWeekStart(start: string, today: string, count = 6): string {
  const candidate = addDays(start, -count);
  return candidate < today ? today : candidate;
}

/**
 * Times the customer sees (Legend 2026-11-05): starts on :00 and :30, plus a
 * :15 or :45 start only when the :00 or :30 start just before it isn't open
 * (it opened up because a booking ended there). Input order is kept.
 */
export function visibleSlots<T extends SlotLike>(slots: T[]): T[] {
  const open = slots.filter((s) => !s.status || s.status === "available");
  const openStarts = new Set(open.map((s) => toMinutes(s.startTime)));
  return open.filter((s) => {
    const mins = toMinutes(s.startTime);
    if (!Number.isFinite(mins)) return false;
    const m = mins % 60;
    if (m === 0 || m === 30) return true;
    if (m === 15 || m === 45) return !openStarts.has(mins - 15);
    return false;
  });
}

/** Morning before 12:00, afternoon 12:00 to 16:59, evening 17:00 on. */
export function groupByPeriod<T extends SlotLike>(slots: T[]): {
  morning: T[];
  afternoon: T[];
  evening: T[];
} {
  const morning: T[] = [];
  const afternoon: T[] = [];
  const evening: T[] = [];
  for (const s of slots) {
    const mins = toMinutes(s.startTime);
    if (mins < 12 * 60) morning.push(s);
    else if (mins < 17 * 60) afternoon.push(s);
    else evening.push(s);
  }
  return { morning, afternoon, evening };
}

/** Status of one day for the week row and month sheet. */
export function dayStatus(
  iso: string,
  today: string,
  calendar: { date: string; status: string }[] | undefined,
): DayStatus {
  if (iso < today) return "past";
  if (!calendar) return "unknown";
  const hit = calendar.find((d) => d.date === iso);
  if (!hit) return "unavailable";
  if (hit.status === "available" || hit.status === "partial") return hit.status;
  return "unavailable";
}

export function isBookableStatus(s: DayStatus): boolean {
  return s === "available" || s === "partial";
}

/** First bookable day in the list, or null. */
export function firstBookableDay(
  days: string[],
  today: string,
  calendarFor: (month: string) => { date: string; status: string }[] | undefined,
): string | null {
  for (const d of days) {
    if (isBookableStatus(dayStatus(d, today, calendarFor(monthOf(d))))) return d;
  }
  return null;
}

/** "$275 · $30 deposit" style line for the bottom bar (no service fee). */
export function priceLine(totalCents: number, depositCents?: number | null): string {
  const money = (c: number) =>
    c % 100 === 0 ? `$${(c / 100).toLocaleString("en-US")}` : `$${(c / 100).toFixed(2)}`;
  const total = money(totalCents);
  if (depositCents && depositCents > 0 && depositCents < totalCents) {
    return `${total} · ${money(depositCents)} deposit`;
  }
  return total;
}
