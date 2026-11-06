// Booking redesign step 4 (Legend 2026-11-06): pure helpers for the Booked
// screen shown after paying. No React, so they can be unit tested.

export type BookedPlace = {
  locationType?: "business" | "alternate" | "customer" | "virtual" | string | null;
  /** Business street (already null from the server when the business hides it). */
  businessAddress?: string | null;
  businessShowAddress?: boolean;
  businessCity?: string | null;
  businessState?: string | null;
  alternateLine?: string | null;
  customerLine?: string | null;
  virtualLink?: string | null;
};

const cityState = (city?: string | null, state?: string | null) =>
  [city?.trim(), state?.trim()].filter(Boolean).join(", ");

/**
 * Where the appointment is, as the review screen showed it. A hidden business
 * address stays hidden (city only). Virtual services have no place.
 */
export function bookedPlaceLine(p: BookedPlace): string | null {
  switch (p.locationType) {
    case "virtual":
      return null;
    case "alternate":
      return p.alternateLine?.trim() || null;
    case "customer":
      return p.customerLine?.trim() || null;
    default: {
      const cs = cityState(p.businessCity, p.businessState);
      const street = p.businessShowAddress === false ? "" : p.businessAddress?.trim() ?? "";
      return [street, cs].filter(Boolean).join(", ") || null;
    }
  }
}

/** "HH:MM" on "YYYY-MM-DD" → a Date in the phone's time zone. */
export function localDateTime(isoDate: string, hhmm: string): Date | null {
  const [y, mo, d] = isoDate.split("-").map((x) => parseInt(x, 10));
  const [h, mi] = hhmm.split(":").map((x) => parseInt(x, 10));
  if (![y, mo, d, h, mi].every(Number.isFinite)) return null;
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

export type BookedCalendarEvent = {
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes: string;
  url?: string;
};

/**
 * The event handed to the phone's calendar editor. End falls back to start plus
 * the duration, then to one hour. Returns null when the time can't be read.
 */
export function bookedCalendarEvent(o: {
  serviceName: string;
  providerName: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  durationMinutes?: number | null;
  place?: string | null;
  virtualLink?: string | null;
  bookingNumber?: number | null;
}): BookedCalendarEvent | null {
  const start = localDateTime(o.date, o.startTime);
  if (!start) return null;
  let end = o.endTime ? localDateTime(o.date, o.endTime) : null;
  if (!end || end <= start) {
    const mins = o.durationMinutes && o.durationMinutes > 0 ? o.durationMinutes : 60;
    end = new Date(start.getTime() + mins * 60000);
  }
  const name = o.providerName.trim();
  const title = name ? `${o.serviceName} with ${name}` : o.serviceName;
  const link = o.virtualLink?.trim() || undefined;
  const notes = [
    "Booked on Outsyde. Your booking details are in the Outsyde app.",
    typeof o.bookingNumber === "number" ? `Booking #${o.bookingNumber}` : null,
    link ? `Meeting link: ${link}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    title,
    startDate: start,
    endDate: end,
    ...(o.place ? { location: o.place } : {}),
    notes,
    ...(link ? { url: link } : {}),
  };
}

/** "+600 points pending" with when they land, or null when there is nothing to show. */
export function pendingPointsLine(points: number | null | undefined, isRequest: boolean): { label: string; when: string } | null {
  if (typeof points !== "number" || !Number.isFinite(points) || points <= 0) return null;
  return {
    label: `+${Math.round(points).toLocaleString("en-US")} points pending`,
    when: isRequest ? "once accepted" : "added after your visit",
  };
}

/** Add to calendar only for a booking that is really happening (not a request still waiting). */
export function canAddToCalendar(isRequest: boolean, event: BookedCalendarEvent | null): boolean {
  return !isRequest && event !== null;
}
