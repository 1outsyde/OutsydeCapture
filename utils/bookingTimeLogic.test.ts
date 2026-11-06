import test from "node:test";
import assert from "node:assert/strict";
import {
  visibleSlots,
  groupByPeriod,
  weekWindow,
  weekStartFor,
  previousWeekStart,
  monthsTouched,
  dayStatus,
  firstBookableDay,
  priceLine,
  addDays,
} from "./bookingTimeLogic";

const s = (startTime: string, status = "available") => ({ startTime, status });
const starts = (xs: { startTime: string }[]) => xs.map((x) => x.startTime);

test("open day shows only :00 and :30 starts", () => {
  const slots = ["09:00", "09:15", "09:30", "09:45", "10:00"].map((t) => s(t));
  assert.deepEqual(starts(visibleSlots(slots)), ["09:00", "09:30", "10:00"]);
});

test("a :45 start shows when the :30 before it is not open (booking ended there)", () => {
  // 15:30 taken (booking ends 15:30 plus the gap), 15:45 opens up.
  const slots = [s("15:00"), s("15:45"), s("16:00"), s("16:15")];
  assert.deepEqual(starts(visibleSlots(slots)), ["15:00", "15:45", "16:00"]);
});

test("a :15 start shows when the :00 before it is not open", () => {
  const slots = [s("10:15"), s("10:30"), s("10:45")];
  assert.deepEqual(starts(visibleSlots(slots)), ["10:15", "10:30"]);
});

test("held or booked slots never show and don't count as open", () => {
  const slots = [s("11:00", "booked"), s("11:15"), s("11:30", "held"), s("11:45")];
  assert.deepEqual(starts(visibleSlots(slots)), ["11:15", "11:45"]);
});

test("odd minutes and bad times are dropped", () => {
  assert.deepEqual(starts(visibleSlots([s("09:10"), s("bad"), s("09:30")])), ["09:30"]);
});

test("groups into morning, afternoon, evening", () => {
  const g = groupByPeriod([s("09:00"), s("11:59"), s("12:00"), s("16:30"), s("17:00"), s("19:30")]);
  assert.deepEqual(starts(g.morning), ["09:00", "11:59"]);
  assert.deepEqual(starts(g.afternoon), ["12:00", "16:30"]);
  assert.deepEqual(starts(g.evening), ["17:00", "19:30"]);
});

test("week window spans month and year ends", () => {
  assert.deepEqual(weekWindow("2026-12-29", 6), [
    "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03",
  ]);
  assert.deepEqual(monthsTouched(weekWindow("2026-12-29", 6)), ["2026-12", "2027-01"]);
});

test("week start keeps the selected day visible and never goes before today", () => {
  assert.equal(weekStartFor("2026-12-10", "2026-11-05"), "2026-12-08");
  assert.equal(weekStartFor("2026-11-06", "2026-11-05"), "2026-11-05");
  assert.equal(previousWeekStart("2026-11-08", "2026-11-05"), "2026-11-05");
  assert.equal(previousWeekStart("2026-11-20", "2026-11-05"), "2026-11-14");
});

test("addDays handles daylight saving change (Nov 1 2026, US)", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-11-01", 1), "2026-11-02");
});

test("day status: past, unknown, available, unavailable", () => {
  const cal = [
    { date: "2026-11-06", status: "available" },
    { date: "2026-11-07", status: "partial" },
    { date: "2026-11-08", status: "unavailable" },
  ];
  assert.equal(dayStatus("2026-11-04", "2026-11-05", cal), "past");
  assert.equal(dayStatus("2026-11-06", "2026-11-05", undefined), "unknown");
  assert.equal(dayStatus("2026-11-06", "2026-11-05", cal), "available");
  assert.equal(dayStatus("2026-11-07", "2026-11-05", cal), "partial");
  assert.equal(dayStatus("2026-11-08", "2026-11-05", cal), "unavailable");
  assert.equal(dayStatus("2026-11-09", "2026-11-05", cal), "unavailable");
});

test("first bookable day across two months", () => {
  const cals: Record<string, { date: string; status: string }[]> = {
    "2026-11": [{ date: "2026-11-30", status: "unavailable" }],
    "2026-12": [{ date: "2026-12-01", status: "partial" }],
  };
  assert.equal(
    firstBookableDay(["2026-11-30", "2026-12-01"], "2026-11-05", (m) => cals[m]),
    "2026-12-01",
  );
  assert.equal(firstBookableDay(["2026-11-30"], "2026-11-05", (m) => cals[m]), null);
});

test("price line shows deposit only when it is a real part payment", () => {
  assert.equal(priceLine(27500, 3000), "$275 · $30 deposit");
  assert.equal(priceLine(27500, null), "$275");
  assert.equal(priceLine(27500, 27500), "$275");
  assert.equal(priceLine(2550, 700), "$25.50 · $7 deposit");
  assert.equal(priceLine(150000, 5000), "$1,500 · $50 deposit");
});
