import test from "node:test";
import assert from "node:assert/strict";
import {
  bookedPlaceLine,
  bookedCalendarEvent,
  localDateTime,
  pendingPointsLine,
  canAddToCalendar,
} from "./bookingBookedLogic";

test("place: business address shown", () => {
  assert.equal(
    bookedPlaceLine({ locationType: "business", businessAddress: "12 Main St", businessCity: "Freeport", businessState: "NY" }),
    "12 Main St, Freeport, NY",
  );
});

test("place: hidden business address shows the city only", () => {
  assert.equal(
    bookedPlaceLine({ locationType: "business", businessShowAddress: false, businessAddress: "12 Main St", businessCity: "Freeport ", businessState: "NY" }),
    "Freeport, NY",
  );
  assert.equal(bookedPlaceLine({ locationType: null, businessAddress: null, businessCity: "Riverdale", businessState: "GA" }), "Riverdale, GA");
});

test("place: alternate, customer, virtual", () => {
  assert.equal(bookedPlaceLine({ locationType: "alternate", alternateLine: "5 Oak Ave, Hempstead, NY" }), "5 Oak Ave, Hempstead, NY");
  assert.equal(bookedPlaceLine({ locationType: "customer", customerLine: "9 Elm St, Merrick, NY 11566" }), "9 Elm St, Merrick, NY 11566");
  assert.equal(bookedPlaceLine({ locationType: "virtual", virtualLink: "https://zoom.us/x" }), null);
  assert.equal(bookedPlaceLine({ locationType: "business" }), null);
});

test("local date and time", () => {
  const d = localDateTime("2026-11-12", "10:30");
  assert.ok(d);
  assert.equal(d!.getFullYear(), 2026);
  assert.equal(d!.getMonth(), 10);
  assert.equal(d!.getDate(), 12);
  assert.equal(d!.getHours(), 10);
  assert.equal(d!.getMinutes(), 30);
  assert.equal(localDateTime("bad", "10:00"), null);
  assert.equal(localDateTime("2026-11-12", "x"), null);
});

test("calendar event: title, times, place, notes", () => {
  const e = bookedCalendarEvent({
    serviceName: "Small mid back knotless",
    providerName: "Braids With Love",
    date: "2026-11-12",
    startTime: "10:00",
    endTime: "14:00",
    place: "Freeport, NY",
    bookingNumber: 42,
  })!;
  assert.equal(e.title, "Small mid back knotless with Braids With Love");
  assert.equal(e.startDate.getHours(), 10);
  assert.equal(e.endDate.getHours(), 14);
  assert.equal(e.location, "Freeport, NY");
  assert.match(e.notes, /Booking #42/);
  assert.equal(e.url, undefined);
});

test("calendar event: end falls back to duration, then one hour", () => {
  const a = bookedCalendarEvent({ serviceName: "Trim", providerName: "X", date: "2026-11-12", startTime: "10:00", durationMinutes: 90 })!;
  assert.equal((a.endDate.getTime() - a.startDate.getTime()) / 60000, 90);
  const b = bookedCalendarEvent({ serviceName: "Trim", providerName: "X", date: "2026-11-12", startTime: "10:00", endTime: "09:00" })!;
  assert.equal((b.endDate.getTime() - b.startDate.getTime()) / 60000, 60);
});

test("calendar event: virtual link, no place", () => {
  const e = bookedCalendarEvent({ serviceName: "Consult", providerName: "X", date: "2026-11-12", startTime: "10:00", virtualLink: " https://zoom.us/j/1 " })!;
  assert.equal(e.location, undefined);
  assert.equal(e.url, "https://zoom.us/j/1");
  assert.match(e.notes, /Meeting link: https:\/\/zoom\.us\/j\/1/);
});

test("calendar event: bad time → null; hidden from requests", () => {
  assert.equal(bookedCalendarEvent({ serviceName: "Trim", providerName: "X", date: "2026-11-12", startTime: "" }), null);
  const e = bookedCalendarEvent({ serviceName: "Trim", providerName: "X", date: "2026-11-12", startTime: "10:00" });
  assert.equal(canAddToCalendar(false, e), true);
  assert.equal(canAddToCalendar(true, e), false);
  assert.equal(canAddToCalendar(false, null), false);
});

test("points line uses the server number", () => {
  assert.deepEqual(pendingPointsLine(600, false), { label: "+600 points pending", when: "added after your visit" });
  assert.deepEqual(pendingPointsLine(2500, true), { label: "+2,500 points pending", when: "once accepted" });
  assert.equal(pendingPointsLine(0, false), null);
  assert.equal(pendingPointsLine(undefined, false), null);
  assert.equal(pendingPointsLine(NaN, false), null);
});
