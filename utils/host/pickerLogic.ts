/** Date and time picker helpers for the event editor (canvas 32). Dates are "YYYY-MM-DD", times "HH:MM" (24 hour). */
import { zonedParts } from "../eventsLogic";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT_MONTHS = MONTHS.map((m) => m.slice(0, 3));
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");

export type YM = { y: number; m: number };

/** Month as weeks starting on Sunday: null for the blanks around the days. */
export function monthGrid(y: number, m: number): (string | null)[] {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: (string | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) out.push(`${y}-${pad(m)}-${pad(d)}`);
  while (out.length % 7) out.push(null);
  return out;
}

export function shiftMonth(ym: YM, by: number): YM {
  const i = ym.y * 12 + (ym.m - 1) + by;
  return { y: Math.floor(i / 12), m: (i % 12) + 1 };
}

export function monthTitle(ym: YM): string {
  return `${MONTHS[ym.m - 1]} ${ym.y}`;
}

export function monthOf(date: string): YM | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(date);
  return m ? { y: Number(m[1]), m: Number(m[2]) } : null;
}

/** "Sat, Oct 31", with the year when it isn't the current one. */
export function dateLabel(date: string, thisYear: number = new Date().getFullYear()): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return "Pick a date";
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const wd = WEEKDAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  return `${wd}, ${SHORT_MONTHS[mo - 1]} ${d}${y === thisYear ? "" : `, ${y}`}`;
}

/** "9:00 PM". */
export function timeLabel(time: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return "Pick a time";
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
}

/** Times every `step` minutes, plus a saved time that isn't on the step (so it stays pickable). */
export function timeOptions(step: number, keep?: string): string[] {
  const out: string[] = [];
  for (let mins = 0; mins < 24 * 60; mins += step) out.push(`${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`);
  if (keep && /^\d{2}:\d{2}$/.test(keep) && !out.includes(keep)) {
    out.push(keep);
    out.sort();
  }
  return out;
}

/** Today's date in a time zone. */
export function todayIn(tz: string, now: Date = new Date()): string {
  const p = zonedParts(now, tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}
