/**
 * Quotes step 6b (app): goutsyde.com/q/<code> links open the quote. Legend 2026-11-06 (App Store build calls 2 and 3,
 * as recommended). Copy rules: commas and periods, no dashes, never the fee rate.
 * Run: npx tsx utils/quoteLinks.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseQuoteLink,
  quoteLinkOutcome,
  quoteWebUrl,
  QUOTE_LINK_COPY,
} from "./quoteLinks";

const clean = (s: string) => !/[—–]| - |%/.test(s);
const CODE = "a1B2c3D4e5F6g7H8"; // 16 characters, base64url, like randomBytes(12)

test("parseQuoteLink reads goutsyde.com and www, /q/<code>, with or without a trailing slash", () => {
  assert.equal(parseQuoteLink(`https://goutsyde.com/q/${CODE}`), CODE);
  assert.equal(parseQuoteLink(`https://www.goutsyde.com/q/${CODE}/`), CODE);
  assert.equal(
    parseQuoteLink(`https://GOUTSYDE.com/q/${CODE}?utm_source=email`),
    CODE,
  );
  assert.equal(
    parseQuoteLink("https://goutsyde.com/q/ab-_CD12efGH34"),
    "ab-_CD12efGH34",
  );
});

test("parseQuoteLink ignores everything else", () => {
  for (const u of [
    null,
    undefined,
    "",
    "not a url",
    `http://goutsyde.com/q/${CODE}`,
    `https://evil.com/q/${CODE}`,
    `https://goutsyde.com.evil.com/q/${CODE}`,
    "https://goutsyde.com/q/",
    "https://goutsyde.com/q",
    `https://goutsyde.com/q/${CODE}/extra`,
    "https://goutsyde.com/q/short",
    `https://goutsyde.com/q/${"x".repeat(65)}`,
    "https://goutsyde.com/q/has%20space1234",
    "https://goutsyde.com/claim?token=1",
    "https://goutsyde.com/r/FRIEND",
    `outsyde://q/${CODE}`,
    "outsyde://stripe-return",
  ]) {
    assert.equal(parseQuoteLink(u as any), null, String(u));
  }
});

test("quoteWebUrl is the goutsyde.com page for the same code", () => {
  assert.equal(quoteWebUrl(CODE), `https://goutsyde.com/q/${CODE}`);
  assert.equal(quoteWebUrl("a/b?c"), "https://goutsyde.com/q/a%2Fb%3Fc");
});

test("quoteLinkOutcome: open the quote for the customer, the business and admin", () => {
  for (const access of ["customer", "vendor", "admin"]) {
    assert.deepEqual(
      quoteLinkOutcome({
        status: 200,
        body: { access, quoteId: "q1", preview: {} },
      }),
      { kind: "open", quoteId: "q1" },
    );
  }
});

test("quoteLinkOutcome: signed out gets the preview and Sign in", () => {
  const preview = { title: "Two bedroom move", businessName: "Royal Elite" };
  assert.deepEqual(
    quoteLinkOutcome({ status: 200, body: { access: "preview", preview } }),
    { kind: "preview", preview },
  );
});

test("quoteLinkOutcome: another account, a bad link, and anything unexpected", () => {
  assert.deepEqual(
    quoteLinkOutcome({ status: 403, body: { code: "OTHER_ACCOUNT" } }),
    { kind: "other-account" },
  );
  assert.deepEqual(
    quoteLinkOutcome({ status: 404, body: { code: "NOT_FOUND" } }),
    { kind: "not-found" },
  );
  assert.deepEqual(quoteLinkOutcome({ status: 500, body: null }), {
    kind: "error",
  });
  assert.deepEqual(
    quoteLinkOutcome({ status: 200, body: { access: "customer" } }),
    { kind: "error" },
  );
  assert.deepEqual(quoteLinkOutcome({ status: 0, body: null }), {
    kind: "error",
  });
});

test("the screen copy follows the rules", () => {
  for (const s of Object.values(QUOTE_LINK_COPY)) assert.ok(clean(s), s);
  assert.match(QUOTE_LINK_COPY.otherAccount, /another Outsyde account/);
  assert.match(QUOTE_LINK_COPY.notFound, /isn't valid/);
});
