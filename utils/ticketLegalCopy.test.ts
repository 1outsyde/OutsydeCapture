/**
 * Ticket terms and privacy text in the app (built into the app, so it ships only with a store build).
 * Same facts as the backend does today: buyer and host refunds return the ticket price (service fee kept);
 * a cancelled event refunds everything, fee included; no refund or RSVP change after the start or a check in;
 * on hold keeps tickets valid. Copy rules: no dashes, never a fee percentage.
 * Run: npx tsx utils/ticketLegalCopy.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CHECKOUT_FEE_NOTE,
  REFUND_POLICY_URL,
  TICKET_TERMS_LEAD,
} from "./eventsLogic";

const read = (f: string) =>
  readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const terms = read("screens/TermsOfServiceScreen.tsx");
const privacy = read("screens/PrivacyPolicyScreen.tsx");

/** The text between a subheading or section title and the next one. */
function block(src: string, start: string, end: string): string {
  const i = src.indexOf(start);
  assert.ok(i >= 0, `missing: ${start}`);
  const j = src.indexOf(end, i + start.length);
  return src.slice(i, j < 0 ? undefined : j);
}

test("Terms: Event Tickets and RSVPs says what the platform does", () => {
  const t = block(terms, "Event Tickets and RSVPs", "</Section>");
  for (const fact of [
    "refunds until a set time before the event starts",
    "can only become more flexible for ticket holders",
    "you get the ticket price back. The service fee is not refunded.",
    "after the event starts or after a ticket on the order has been checked in",
    "refunded in full, including the service fee, and every free RSVP is cancelled",
    "tickets already issued stay valid",
    "Event Host Agreement",
  ])
    assert.ok(t.includes(fact), fact);
  assert.ok(
    !t.includes("When the Platform supports ticketed events"),
    "old wording gone",
  );
  assert.ok(!/Postponed events/.test(t), "no postpone promise (not a feature)");
  assert.ok(terms.includes("Last Updated: November 2026"));
});

test("Privacy: Events and Tickets section, numbered in order", () => {
  const p = block(
    privacy,
    '<Section title="8. Events and Tickets">',
    "</Section>",
  );
  for (const fact of [
    "first name or username, your ticket type and whether you have checked in",
    "They don't see your email address, phone number or payment details.",
    "not who bought them",
    "the Host is not told who reported it",
    "Apple Wallet",
  ])
    assert.ok(p.includes(fact), fact);
  const titles = [
    ...privacy
      .slice(0, privacy.indexOf("Last Updated: 01/23/2026"))
      .matchAll(/<Section title="(\d+)\. /g),
  ].map((m) => Number(m[1]));
  assert.deepEqual(
    titles,
    Array.from({ length: 18 }, (_, i) => i + 1),
  );
  assert.ok(privacy.includes("Last Updated: November 2, 2026"));
});

test("checkout and event page lines", () => {
  assert.equal(
    TICKET_TERMS_LEAD.event,
    "By getting tickets or RSVPing, you agree to the ",
  );
  assert.equal(TICKET_TERMS_LEAD.checkout, "By paying, you agree to the ");
  assert.equal(
    CHECKOUT_FEE_NOTE,
    "The service fee isn't refunded unless the event is cancelled.",
  );
  assert.equal(REFUND_POLICY_URL, "https://www.goutsyde.com/refund-policy");
});

test("copy rules on the new text: no dashes, no percentages", () => {
  const added = [
    block(terms, "Event Tickets and RSVPs", "</Section>"),
    block(privacy, '<Section title="8. Events and Tickets">', "</Section>"),
    TICKET_TERMS_LEAD.event,
    TICKET_TERMS_LEAD.checkout,
    CHECKOUT_FEE_NOTE,
  ].join(" ");
  assert.deepEqual(added.match(/.{0,20}([‒–—―]| - ).{0,20}/g) ?? [], []);
  assert.deepEqual(added.match(/.{0,20}\d\s*%.{0,20}/g) ?? [], []);
});
