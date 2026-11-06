import test from "node:test";
import assert from "node:assert/strict";
import {
  agreementParts,
  agreementText,
  payBlockReason,
  isAddressComplete,
  agreementPayload,
  OUTSYDE_TERMS_VERSION,
} from "./bookingReviewLogic";

const base = { hasPolicy: true, hasVendorTerms: true, providerName: "Braids With Love", locationType: "business" as const };

test("all three parts at the business address", () => {
  assert.equal(
    agreementText(agreementParts(base)),
    "I agree to the cancellation policy, Braids With Love's terms and the Outsyde Terms, and I understand this appointment is at the address above.",
  );
});

test("no vendor terms", () => {
  assert.equal(
    agreementText(agreementParts({ ...base, hasVendorTerms: false })),
    "I agree to the cancellation policy and the Outsyde Terms, and I understand this appointment is at the address above.",
  );
});

test("no policy, vendor terms only", () => {
  assert.equal(
    agreementText(agreementParts({ ...base, hasPolicy: false })),
    "I agree to Braids With Love's terms and the Outsyde Terms, and I understand this appointment is at the address above.",
  );
});

test("Outsyde Terms only (always there)", () => {
  assert.equal(
    agreementText(agreementParts({ ...base, hasPolicy: false, hasVendorTerms: false })),
    "I agree to the Outsyde Terms, and I understand this appointment is at the address above.",
  );
});

test("location endings", () => {
  const end = (o: Partial<Parameters<typeof agreementParts>[0]>) =>
    agreementText(agreementParts({ ...base, hasPolicy: false, hasVendorTerms: false, ...o })).replace("I agree to the Outsyde Terms", "");
  assert.equal(end({ addressHidden: true }), ", and I understand this appointment is in the city above.");
  assert.equal(end({ locationType: null }), ", and I understand this appointment is at the address above.");
  assert.equal(end({ locationType: "alternate" }), ", and I understand this service is at the address above.");
  assert.equal(end({ locationType: "customer" }), ", and I'll be ready at the address I entered.");
  assert.equal(end({ locationType: "virtual" }), ", and I'll join the meeting link at my appointment time.");
});

test("links point at the right pages, in order", () => {
  const links = agreementParts(base).filter((p) => p.kind === "link");
  assert.deepEqual(links.map((l) => (l.kind === "link" ? l.target : "")), ["policy", "vendorTerms", "outsydeTerms"]);
});

test("blank provider name never reads \"'s terms\"", () => {
  assert.match(agreementText(agreementParts({ ...base, providerName: "  " })), /the business's terms/);
});

test("pay reason order: total, address, policy, box", () => {
  const ok = { amountsReady: true, needsAddress: false, addressComplete: false, policyLoading: false, agreed: true };
  assert.equal(payBlockReason(ok), null);
  assert.equal(payBlockReason({ ...ok, amountsReady: false, agreed: false }), "Getting your total…");
  assert.equal(payBlockReason({ ...ok, needsAddress: true, agreed: false }), "Add your service address");
  assert.equal(payBlockReason({ ...ok, needsAddress: true, addressComplete: true }), null);
  assert.equal(payBlockReason({ ...ok, policyLoading: true }), "Loading the cancellation policy…");
  assert.equal(payBlockReason({ ...ok, agreed: false }), "Check the box above to agree first");
});

test("address needs every part", () => {
  assert.equal(isAddressComplete({ line1: "1 Main St", city: "Freeport", state: "NY", zipCode: "11520" }), true);
  assert.equal(isAddressComplete({ line1: "1 Main St", city: "Freeport", state: "NY", zipCode: " " }), false);
});

test("agreement is only sent when checked", () => {
  assert.equal(agreementPayload(false), undefined);
  assert.deepEqual(agreementPayload(true), { agreed: true, termsVersion: OUTSYDE_TERMS_VERSION });
  assert.equal(OUTSYDE_TERMS_VERSION, "2026-11");
});
