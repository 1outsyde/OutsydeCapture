/** Unit tests for the event editor helpers, ported from goutsyde.com tests/events-editor-logic.test.ts. npx tsx utils/host/editorLogic.test.ts */
import {
  isoInZone, eventTimes, formFromEvent, emptyForm, validateForm, createBody, patchBody,
  emptySheet, switchPaid, sheetFromType, parsePriceCents, ticketBody, ticketRowLines, ticketsSummary,
  refundLabel, addressLabel, hostOptions, dayOfNote, previewPrice, refundChangeAllowed, isScrolledToEnd,
  publishFailure, nextStepLabel, usTimeZones, shareUrl, flatError, canRemoveType, hostSetupState, timeZoneLabel,
  addDaysToDate, autoEndDate, clockChangeNote, changedFields, profilePayoutNote, whenRange,
  type HostEvent, type HostTicketType, type EventForm,
} from "./editorLogic";
import { hostEarningsCents } from "./hostFees";
import { stripeUrl, safeHttpUrl } from "./editorLogic";

let passed = 0, failed = 0;
function eq(actual: unknown, expected: unknown, name: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ok  ${name}`); } else { failed++; console.error(`  FAIL ${name}`, JSON.stringify(actual), "expected", JSON.stringify(expected)); }
}

const NY = "America/New_York";
const mkEvent = (o: Partial<HostEvent> = {}): HostEvent => ({
  id: "e1", slug: "block-party-abc123", status: "draft", hostType: "user", title: "Block Party", description: "Bring a chair",
  coverImageUrl: "https://media.example/covers/a.jpg", startsAt: "2026-10-26T01:00:00.000Z", endsAt: "2026-10-26T06:00:00.000Z",
  timezone: NY, venueName: "The Hall", addressLine1: "12 Main St", addressLine2: null, city: "Freeport", state: "NY", postalCode: "11520",
  addressVisibility: "ticket_holders_day_of", visibility: "public", capacity: 200, takenCount: 0,
  refundPolicy: "until_cutoff", refundCutoffHours: 24, publishedAt: null, cancelledAt: null, ...o,
});
const mkType = (o: Partial<HostTicketType> = {}): HostTicketType => ({
  id: "t1", name: "Free RSVP", description: null, priceCents: 0, quantity: 50, takenCount: 0, salesStartAt: null, salesEndAt: null,
  unlockAfterTicketTypeId: null, minPerOrder: 1, maxPerOrder: 1, perAccountLimit: 1, hidden: false, sortOrder: 0, status: "active", ...o,
});

console.log("isoInZone / eventTimes");
eq(isoInZone("2026-10-25", "21:00", NY), "2026-10-25T21:00:00-04:00", "EDT wall clock gets -04:00");
eq(isoInZone("2026-12-05", "21:00", NY), "2026-12-05T21:00:00-05:00", "EST wall clock gets -05:00");
eq(isoInZone("2026-10-25", "21:00", "Asia/Kolkata"), "2026-10-25T21:00:00+05:30", "half hour offset");
eq(isoInZone("2026-10-25", "21:00", "UTC"), "2026-10-25T21:00:00+00:00", "UTC is +00:00");
eq(isoInZone("2026-12-31", "23:30", NY, 1), "2027-01-01T23:30:00-05:00", "addDays rolls over the year");
eq(isoInZone("2026-10-25", "21:00", "Not/AZone"), null, "unknown zone is null");
eq(isoInZone("2026-10-25", "", NY), null, "missing time is null");
eq(isoInZone("10/25/2026", "21:00", NY), null, "wrong date format is null");
eq(new Date(isoInZone("2026-10-25", "21:00", NY)!).toISOString(), "2026-10-26T01:00:00.000Z", "offset string is the right instant");
eq(eventTimes({ date: "2026-10-25", startTime: "21:00", endTime: "02:00", endDate: "", timezone: NY }),
  { startsAt: "2026-10-25T21:00:00-04:00", endsAt: "2026-10-26T02:00:00-04:00" }, "end earlier than start is the next day");
eq(eventTimes({ date: "2026-10-25", startTime: "18:00", endTime: "22:00", endDate: "", timezone: NY }),
  { startsAt: "2026-10-25T18:00:00-04:00", endsAt: "2026-10-25T22:00:00-04:00" }, "same day end");
eq(eventTimes({ date: "2026-10-31", startTime: "22:00", endTime: "03:00", endDate: "", timezone: NY }),
  { startsAt: "2026-10-31T22:00:00-04:00", endsAt: "2026-11-01T03:00:00-05:00" }, "next day across the DST change keeps each side's offset");

console.log("formFromEvent");
const f0 = formFromEvent(mkEvent());
eq([f0.date, f0.startTime, f0.endTime, f0.timezone], ["2026-10-25", "21:00", "02:00", NY], "times in the event's own zone");
eq([f0.title, f0.description, f0.venueName, f0.addressLine2, f0.city, f0.state, f0.postalCode], ["Block Party", "Bring a chair", "The Hall", "", "Freeport", "NY", "11520"], "text fields, null becomes empty");
eq([f0.addressVisibility, f0.listed, f0.capacity, f0.refundPolicy, f0.refundCutoffHours, f0.hostAs], ["ticket_holders_day_of", true, "200", "until_cutoff", "24", "user"], "choices and numbers");
const f1 = formFromEvent(mkEvent({ visibility: "unlisted", capacity: null, refundPolicy: "no_refunds", refundCutoffHours: null, hostType: "business", description: null }));
eq([f1.listed, f1.capacity, f1.refundPolicy, f1.hostAs, f1.description], [false, "", "no_refunds", "business", ""], "unlisted, no capacity, no refunds, business host");
eq(eventTimes(f0), { startsAt: "2026-10-25T21:00:00-04:00", endsAt: "2026-10-26T02:00:00-04:00" }, "round trip: form back to the same instants");

console.log("multi day events");
const three = mkEvent({ startsAt: "2026-10-25T00:00:00.000Z", endsAt: "2026-10-28T00:00:00.000Z" }); // Oct 24 20:00 to Oct 27 20:00 EDT
const f3 = formFromEvent(three);
eq([f3.date, f3.startTime, f3.endTime, f3.endDate], ["2026-10-24", "20:00", "20:00", "2026-10-27"], "a 3 day event keeps its end date");
eq(eventTimes(f3), { startsAt: "2026-10-24T20:00:00-04:00", endsAt: "2026-10-27T20:00:00-04:00" }, "3 day round trip: same instants");
eq(validateForm({ ...f3 }), null, "same start and end time on different days is valid");
eq(patchBody(f3, { ...f3, endTime: "23:00" }), { endsAt: "2026-10-27T23:00:00-04:00" }, "end only edit keeps the end date");
eq(patchBody(f3, { ...f3, endDate: "2026-10-26" }), { endsAt: "2026-10-26T20:00:00-04:00" }, "end date edit sends the end only");
eq(formFromEvent(mkEvent()).endDate, "", "an ordinary next day end leaves the end date empty");
eq(formFromEvent(mkEvent({ endsAt: "2026-10-26T03:00:00.000Z" })).endDate, "", "a same day end leaves it empty");
eq(formFromEvent(mkEvent({ endsAt: "2026-10-27T02:00:00.000Z" })).endDate, "2026-10-26", "next day with a later end time keeps the end date");
eq(validateForm({ ...f3, endDate: "2026-10-23" }), "The event has to end after it starts.", "end date before the start refused");
eq([addDaysToDate("2026-12-31", 1), autoEndDate({ date: "2026-10-25", startTime: "21:00", endTime: "02:00" }), autoEndDate({ date: "2026-10-25", startTime: "18:00", endTime: "22:00" })], ["2027-01-01", "2026-10-26", "2026-10-25"], "auto end date");
eq(whenRange(three.startsAt, three.endsAt, NY), "Sat, Oct 24, 8:00 PM to Tue, Oct 27, 8:00 PM", "review shows both dates for a multi day event");
eq(whenRange("2026-10-26T01:00:00.000Z", "2026-10-26T06:00:00.000Z", NY), "Sun, Oct 25, 9:00 PM to 2:00 AM", "review keeps the short form for an overnight event");

console.log("clock change (spring forward gap, America/New_York 2026-03-08 02:00 to 03:00)");
eq(isoInZone("2026-03-08", "02:30", NY), "2026-03-08T01:30:00-05:00", "02:30 doesn't exist: the zone math lands on 01:30 EST");
eq(clockChangeNote("2026-03-08", "02:30", NY), "That time doesn't exist on this date because of the clock change. We'll use 1:30 AM.", "note says the time that will be saved");
eq(clockChangeNote("2026-03-08", "03:30", NY), null, "a real time has no note");
eq(clockChangeNote("2026-11-01", "01:30", NY), null, "the repeated fall back hour has no note");

console.log("validateForm");
const good: EventForm = { ...emptyForm(NY), title: "Party", date: "2026-11-20", startTime: "21:00", endTime: "23:00" };
eq(validateForm(good), null, "complete form is valid");
eq(validateForm({ ...good, title: "  " }), "Give your event a name.", "name required");
eq(validateForm({ ...good, date: "" }), "Pick a date for your event.", "date required");
eq(validateForm({ ...good, endTime: "" }), "Pick when your event starts and ends.", "times required");
eq(validateForm({ ...good, endTime: "21:00" }), "The event has to end after it starts.", "same start and end refused");
eq(validateForm({ ...good, capacity: "0" }), "Capacity has to be a whole number from 1 to 100,000, or left empty.", "capacity 0 refused");
eq(validateForm({ ...good, capacity: "12.5" }), "Capacity has to be a whole number from 1 to 100,000, or left empty.", "capacity decimal refused");
eq(validateForm({ ...good, refundPolicy: "until_cutoff", refundCutoffHours: "" }), "Enter how many hours before the event refunds stop.", "refund hours needed");
eq(validateForm({ ...good, refundPolicy: "no_refunds", refundCutoffHours: "" }), null, "no refunds needs no hours");

console.log("createBody");
eq(createBody(good), {
  hostAs: "user", title: "Party", startsAt: "2026-11-20T21:00:00-05:00", endsAt: "2026-11-20T23:00:00-05:00", timezone: NY,
  addressVisibility: "ticket_holders", visibility: "public", refundPolicy: "until_cutoff", refundCutoffHours: 24,
}, "minimal create body, empty optional fields left out");
eq(createBody({ ...good, title: " Party ", city: " Freeport ", capacity: "80", listed: false, hostAs: "business", coverImageUrl: "https://x/c.jpg", refundPolicy: "no_refunds" }), {
  hostAs: "business", title: "Party", startsAt: "2026-11-20T21:00:00-05:00", endsAt: "2026-11-20T23:00:00-05:00", timezone: NY,
  addressVisibility: "ticket_holders", visibility: "unlisted", refundPolicy: "no_refunds", refundCutoffHours: null,
  city: "Freeport", coverImageUrl: "https://x/c.jpg", capacity: 80,
}, "full create body trims text, unlisted, business, no refunds");

console.log("patchBody");
eq(patchBody(f0, { ...f0 }), {}, "nothing changed sends nothing");
eq(patchBody(f0, { ...f0, title: "Block Party 2" }), { title: "Block Party 2" }, "only the title");
eq(patchBody(f0, { ...f0, city: " Freeport " }), {}, "whitespace only is not a change");
eq(patchBody(f0, { ...f0, venueName: "" }), { venueName: null }, "cleared text sends null");
eq(patchBody(f0, { ...f0, listed: false }), { visibility: "unlisted" }, "Show in Discover off sends unlisted");
eq(patchBody(f0, { ...f0, capacity: "" }), { capacity: null }, "cleared capacity sends null");
eq(patchBody(f0, { ...f0, refundCutoffHours: "12" }), { refundPolicy: "until_cutoff", refundCutoffHours: 12 }, "refund change sends policy and hours");
eq(patchBody(f0, { ...f0, refundPolicy: "no_refunds" }), { refundPolicy: "no_refunds", refundCutoffHours: null }, "no refunds clears hours");
eq(patchBody(f0, { ...f0, endTime: "03:00" }), { endsAt: "2026-10-26T03:00:00-04:00" }, "only the end time: start is not sent");
eq(patchBody(f0, { ...f0, startTime: "20:00" }), { startsAt: "2026-10-25T20:00:00-04:00", endsAt: "2026-10-26T02:00:00-04:00" }, "start moved sends start and end");
eq(patchBody(f0, { ...f0, timezone: "America/Chicago" }), { startsAt: "2026-10-25T21:00:00-05:00", endsAt: "2026-10-26T02:00:00-05:00", timezone: "America/Chicago" }, "zone change sends both times and the zone");
eq(patchBody(f0, { ...f0, coverImageUrl: null }), { coverImageUrl: null }, "removed cover");
eq("hostAs" in patchBody(f0, { ...f0, hostAs: "business" }), false, "host type is never patched");

console.log("ticket sheet");
eq([emptySheet().maxPerOrder, emptySheet().perAccountLimit, emptySheet(true).maxPerOrder, emptySheet(true).perAccountLimit], ["1", "1", "10", ""], "defaults for free and paid");
eq([switchPaid(emptySheet(), true).maxPerOrder, switchPaid(emptySheet(), true).perAccountLimit], ["10", ""], "switching to paid moves untouched defaults");
eq(switchPaid({ ...emptySheet(), maxPerOrder: "4", perAccountLimit: "6" }, true).maxPerOrder, "4", "switching keeps edited values");
eq([parsePriceCents("20"), parsePriceCents("$20.5"), parsePriceCents("1,000.00"), parsePriceCents("20.555"), parsePriceCents("abc"), parsePriceCents("")], [2000, 2050, 100000, null, null, null], "price parsing");
const sheet = { ...emptySheet(), name: "Free RSVP", quantity: "50" };
eq(ticketBody(sheet, NY), { ok: true, body: { name: "Free RSVP", priceCents: 0, quantity: 50, maxPerOrder: 1, perAccountLimit: 1, salesStartAt: null, unlockAfterTicketTypeId: null } }, "free, right away");
eq(ticketBody({ ...emptySheet(true), name: "VIP", price: "$45", quantity: "20", maxPerOrder: "4" }, NY),
  { ok: true, body: { name: "VIP", priceCents: 4500, quantity: 20, maxPerOrder: 4, perAccountLimit: null, salesStartAt: null, unlockAfterTicketTypeId: null } }, "paid, no per person limit");
eq(ticketBody({ ...sheet, salesStart: "date", salesDate: "2026-11-01", salesTime: "10:00" }, NY),
  { ok: true, body: { name: "Free RSVP", priceCents: 0, quantity: 50, maxPerOrder: 1, perAccountLimit: 1, salesStartAt: "2026-11-01T10:00:00-05:00", unlockAfterTicketTypeId: null } }, "sales on a date in the event's zone");
eq(ticketBody({ ...emptySheet(true), name: "Round 2", price: "30", quantity: "75", salesStart: "after", unlockAfterId: "t1" }, NY),
  { ok: true, body: { name: "Round 2", priceCents: 3000, quantity: 75, maxPerOrder: 10, perAccountLimit: null, salesStartAt: null, unlockAfterTicketTypeId: "t1" } }, "opens when another runs out");
eq(ticketBody({ ...sheet, name: " " }, NY), { ok: false, message: "Give this ticket type a name." }, "name required");
eq(ticketBody({ ...emptySheet(true), name: "A", price: "0.50", quantity: "1" }, NY), { ok: false, message: "Set a price from $1.00 to $10,000.00." }, "price under $1 refused");
eq(ticketBody({ ...emptySheet(true), name: "A", price: "10000.01", quantity: "1" }, NY), { ok: false, message: "Set a price from $1.00 to $10,000.00." }, "price over $10,000 refused");
eq(ticketBody({ ...sheet, quantity: "0" }, NY), { ok: false, message: "Enter how many tickets, from 1 to 100,000." }, "quantity 0 refused");
eq(ticketBody({ ...sheet, maxPerOrder: "21" }, NY), { ok: false, message: "Max per order has to be from 1 to 20." }, "max per order over 20 refused");
eq(ticketBody({ ...sheet, maxPerOrder: "3", perAccountLimit: "2" }, NY), { ok: false, message: "Max per order can't be more than the limit per person." }, "max per order over the per person limit");
eq(ticketBody({ ...sheet, salesStart: "date", salesDate: "" }, NY), { ok: false, message: "Pick the date and time sales start." }, "date needed");
eq(ticketBody({ ...sheet, salesStart: "after", unlockAfterId: "" }, NY), { ok: false, message: "Pick which ticket type has to run out first." }, "type to wait on needed");
const vip = mkType({ id: "t2", name: "VIP", priceCents: 4500, quantity: 20, maxPerOrder: 4, perAccountLimit: null, salesStartAt: "2026-11-01T15:00:00.000Z" });
eq(sheetFromType(vip, NY), { paid: true, name: "VIP", price: "45.00", quantity: "20", maxPerOrder: "4", perAccountLimit: "", salesStart: "date", salesDate: "2026-11-01", salesTime: "10:00", unlockAfterId: "" }, "type back into the sheet");
eq(sheetFromType(mkType({ unlockAfterTicketTypeId: "t9" }), NY).salesStart, "after", "unlock type back into the sheet");
eq(ticketBody(sheetFromType(vip, NY), NY), { ok: true, body: { name: "VIP", priceCents: 4500, quantity: 20, maxPerOrder: 4, perAccountLimit: null, salesStartAt: "2026-11-01T10:00:00-05:00", unlockAfterTicketTypeId: null } }, "sheet round trip keeps the same values");

console.log("ticket PATCH sends only changes");
const vipBase = (ticketBody(sheetFromType(mkType({ id: "t5", name: "Round 2", priceCents: 3000, quantity: 75, maxPerOrder: 10, perAccountLimit: null, unlockAfterTicketTypeId: "t1" }), NY), NY) as { ok: true; body: Record<string, unknown> }).body;
eq(changedFields(vipBase, { ...vipBase }), {}, "nothing changed");
eq(changedFields(vipBase, { ...vipBase, quantity: 80 }), { quantity: 80 }, "only the quantity, unlock and price not resent");
eq(changedFields(vipBase, { ...vipBase, unlockAfterTicketTypeId: null }), { unlockAfterTicketTypeId: null }, "clearing the unlock is a change");
eq(profilePayoutNote("business"), "Payouts for this event go to your business's Stripe account. Finish its payout setup in the Outsyde app.", "business payout note");

console.log("labels");
const NOW = new Date("2026-10-23T12:00:00Z");
const free = mkType();
const r2 = mkType({ id: "t3", name: "Round 2", priceCents: 3000, quantity: 75, maxPerOrder: 10, perAccountLimit: null, unlockAfterTicketTypeId: "t2" });
const early = mkType({ id: "t4", name: "Early bird", priceCents: 2000, quantity: 50, maxPerOrder: 10, perAccountLimit: null, unlockAfterTicketTypeId: "t1" });
const all = [free, vip, r2, early];
eq(ticketRowLines(free, all, NY, NOW), { qty: "50 spots · 1 per person", when: "On sale now", price: "Free" }, "free row");
eq(ticketRowLines(vip, all, NY, NOW), { qty: "20 tickets · up to 4 per order", when: "On sale Nov 1 at 10:00 AM", price: "$45.00" }, "paid row with a future sales start");
eq(ticketRowLines(r2, all, NY, NOW).when, "Opens when VIP sells out", "opens after a paid type sells out");
eq(ticketRowLines(early, all, NY, NOW).when, "Opens when Free RSVP runs out", "opens after the free type runs out");
eq(ticketRowLines(mkType({ takenCount: 12 }), all, NY, NOW).qty, "12 of 50 taken · 1 per person", "taken count");
eq(ticketsSummary([free, mkType({ id: "x", name: "General admission", quantity: 150, priceCents: 2000 }), mkType({ id: "y", name: "Old", status: "archived" })]), "Free RSVP (50), General admission (150)", "summary skips removed types");
eq(ticketsSummary([]), "No tickets yet", "empty summary");
eq([refundLabel("until_cutoff", 24), refundLabel("until_cutoff", 1), refundLabel("until_cutoff", 0), refundLabel("no_refunds", null)], ["Until 24 hours before", "Until 1 hour before", "Until the event starts", "No refunds"], "refund labels");
eq([addressLabel("public"), addressLabel("ticket_holders"), addressLabel("ticket_holders_day_of")], ["Shown to everyone", "Shown only to people with a ticket", "Shown to people with a ticket on the day of the event"], "address labels");
eq(dayOfNote("Freeport", "NY"), "Until then they see Freeport, NY only.", "day of note with city and state");
eq(dayOfNote("", ""), "Until then they see the city and state only.", "day of note without a city");
eq(hostOptions({ businessId: "b1", photographerId: null }), ["user", "business"], "business owner");
eq(hostOptions({ businessId: null, photographerId: "p1" }), ["user", "photographer"], "photographer");
eq(hostOptions(null), ["user"], "unknown: only Me");
eq(previewPrice([free, vip, mkType({ id: "h", priceCents: 1000, hidden: true }), mkType({ id: "a", priceCents: 500, status: "archived" })]), { priceFromCents: 4500, hasFree: true, soldOut: false }, "preview price ignores hidden and removed types");

console.log("host earnings (Agreement 6.2, backend calculateTicketFees rounding)");
eq(hostEarningsCents(2000), 1960, "$20.00 earns $19.60");
eq(hostEarningsCents(125), 122, "$1.25: fee 2.5 cents rounds to 3");
eq(hostEarningsCents(175), 171, "$1.75: fee 3.5 cents rounds to 4");
eq(hostEarningsCents(1000000), 980000, "$10,000.00");
eq(hostEarningsCents(0), 0, "free earns 0");
eq(hostEarningsCents(12.5), 0, "non integer cents earn 0");

console.log("rules and gate");
eq(refundChangeAllowed({ policy: "until_cutoff", cutoffHours: 24 }, { policy: "until_cutoff", cutoffHours: 12 }), true, "fewer hours is more flexible");
eq(refundChangeAllowed({ policy: "until_cutoff", cutoffHours: 24 }, { policy: "until_cutoff", cutoffHours: 48 }), false, "more hours is stricter");
eq(refundChangeAllowed({ policy: "until_cutoff", cutoffHours: 24 }, { policy: "no_refunds", cutoffHours: null }), false, "no refunds is stricter");
eq(refundChangeAllowed({ policy: "no_refunds", cutoffHours: null }, { policy: "until_cutoff", cutoffHours: 48 }), true, "from no refunds anything goes");
eq(isScrolledToEnd(0, 300, 1200), false, "top of a long text");
eq(isScrolledToEnd(891, 300, 1200), false, "9 px from the end is not the end");
eq(isScrolledToEnd(892, 300, 1200), true, "8 px from the end counts");
eq(isScrolledToEnd(900, 300, 1200), true, "at the end");
eq(isScrolledToEnd(0, 300, 300), true, "text that fits counts as read");

console.log("publishFailure");
const codes = ["NO_TICKET_TYPES", "NO_VISIBLE_TICKET_TYPES", "PAID_TICKETS_NOT_AVAILABLE", "PAYOUTS_NOT_SET_UP", "EVENT_IN_PAST", "NOT_A_DRAFT", "HOST_AGREEMENT_REQUIRED", "EVENT_CHANGED"];
eq(codes.map((c) => publishFailure(409, { code: c }).next), ["tickets", "tickets", "tickets", "payouts", "new", "manage", "agreement", "reload"], "every refusal has a next step");
eq(codes.every((c) => { const m = publishFailure(409, { code: c }).message; return m.length > 10 && !m.includes(c) && !/[-–—]/.test(m); }), true, "every refusal has plain copy without codes or dashes");
eq(publishFailure(409, { code: "PAID_TICKETS_NOT_AVAILABLE", error: "Paid tickets aren't available yet. Use free tickets for now." }).message, "Paid tickets aren't available yet. Use free tickets for now.", "backend message shown");
eq(publishFailure(409, { code: "EVENT_IN_PAST", error: "The event has already started." }).message, "This event's start time has passed, so it can't be published. Create a new event with a future date.", "in the past says what to do");
eq(publishFailure(409, { code: "AGREEMENT_VERSION_CHANGED", error: "x" }).next, "agreement", "version changed shows the agreement again");
eq(publishFailure(500, { code: "SERVER_ERROR", error: "Couldn't publish the event." }), { message: "Something went wrong. Try again.", code: "SERVER_ERROR", next: null }, "server error is the generic line");
eq(publishFailure(400, { code: "OTHER", error: "Backend says no." }), { message: "Backend says no.", code: "OTHER", next: null }, "unknown code shows the backend message");
eq([nextStepLabel("new"), nextStepLabel("tickets"), nextStepLabel("payouts"), nextStepLabel("reload"), nextStepLabel("manage"), nextStepLabel("agreement")], ["Create a new event", "Go to tickets", "Set up payouts", "Reload", "Manage event", null], "next step labels");

console.log("misc");
eq(usTimeZones("America/Chicago", "America/Chicago"), ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"], "US zones, phone zone already listed");
eq(usTimeZones("Europe/London", "America/New_York")[0], "Europe/London", "the event's own zone stays first when it isn't a US zone");
eq(usTimeZones("America/New_York", "Asia/Tokyo")[0], "Asia/Tokyo", "the phone's zone is offered first");
eq(usTimeZones("", "Mars/Base"), ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"], "an invalid phone zone is left out");
eq([timeZoneLabel("America/New_York"), timeZoneLabel("Pacific/Honolulu"), timeZoneLabel("Europe/London")], ["New York (Eastern)", "Honolulu (Hawaii)", "Europe/London"], "zone labels");

console.log("app error shape");
eq(flatError({ status: 409, body: { success: false, error: { code: "NO_TICKET_TYPES", message: "Add at least one ticket type first." } } }), { status: 409, body: { code: "NO_TICKET_TYPES", error: "Add at least one ticket type first." } }, "nested backend error flattened");
eq(flatError({ message: "Network request failed" }), { status: 0, body: null }, "network failure is status 0");
eq(flatError(null), { status: 0, body: null }, "nothing thrown");
eq(publishFailure(409, { code: "PAYOUTS_NOT_SET_UP", error: "Set up payouts before you publish. Every host needs payouts set up, even for free events." }), { message: "Set up payouts before you publish. Every host needs payouts set up, even for free events.", code: "PAYOUTS_NOT_SET_UP", next: "payouts" }, "free event payout refusal offers payout setup");

console.log("last visible ticket type on a live event");
{
  const t = (id: string, o: Partial<HostTicketType> = {}): HostTicketType => ({ id, name: id, description: null, priceCents: 0, quantity: 10, takenCount: 0, salesStartAt: null, salesEndAt: null, unlockAfterTicketTypeId: null, minPerOrder: 1, maxPerOrder: 1, perAccountLimit: 1, hidden: false, sortOrder: 0, status: "active", ...o });
  const LAST = "A live event needs at least one ticket type. Add another one first, or cancel the event.";
  eq(canRemoveType("published", [t("a")], "a"), { ok: false, reason: LAST }, "the only type of a live event can't be removed or hidden");
  eq(canRemoveType("published", [t("a"), t("b", { hidden: true })], "a"), { ok: false, reason: LAST }, "a hidden type doesn't count as visible");
  eq(canRemoveType("published", [t("a"), t("b", { status: "archived" })], "a"), { ok: false, reason: LAST }, "a removed type doesn't count");
  eq(canRemoveType("published", [t("a"), t("b")], "a"), { ok: true, reason: null }, "another visible type: removing is fine");
  eq(canRemoveType("published", [t("a", { hidden: true }), t("b")], "a"), { ok: true, reason: null }, "removing a hidden type is fine");
  eq(canRemoveType("draft", [t("a")], "a"), { ok: true, reason: null }, "drafts can remove their last type (publish checks)");
}

console.log("payout setup before hosting");
eq(hostSetupState({ hasAccount: false, ready: false, needsSetup: true }), "setup", "no account: set up");
eq(hostSetupState({ hasAccount: true, ready: false, needsSetup: true }), "finish", "unfinished: finish");
eq(hostSetupState({ hasAccount: true, ready: true, needsSetup: false }), "ready", "ready");
eq(hostSetupState(null), "unknown", "status failed to load");
eq(shareUrl("block-party-abc123"), "https://goutsyde.com/e/block-party-abc123", "share link");
eq([safeHttpUrl("https://a.com/x.png"), safeHttpUrl("http://a.com/x.png"), safeHttpUrl("javascript:alert(1)"), safeHttpUrl("https://"), safeHttpUrl(""), safeHttpUrl(null), safeHttpUrl("https://a.com/x y")],
  ["https://a.com/x.png", "http://a.com/x.png", null, null, null, null, null], "image links: http and https only");
eq([stripeUrl("https://connect.stripe.com/setup/e/x"), stripeUrl("http://connect.stripe.com/x"), stripeUrl("https://evil.com/stripe.com"), stripeUrl(5)], ["https://connect.stripe.com/setup/e/x", null, null, null], "stripe links only");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
