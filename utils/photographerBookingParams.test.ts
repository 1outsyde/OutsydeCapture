import test from "node:test";
import assert from "node:assert/strict";
import { photographerBookingParams, photographerName } from "./photographerBookingParams";

test("name like the old screen: displayName, then name, then Photographer", () => {
  assert.equal(photographerName({ displayName: "Gicasso Films", name: "Gregory" }), "Gicasso Films");
  assert.equal(photographerName({ name: "Giovanni" }), "Giovanni");
  assert.equal(photographerName({ name: "  " }), "Photographer");
  assert.equal(photographerName(null), "Photographer");
});

test("studio address + city and state", () => {
  const p = photographerBookingParams("ph1", { name: "Gio", studioAddress: " 9 Studio Rd ", city: "Freeport", state: "NY" }, "dark");
  assert.equal(p.providerAddress, "9 Studio Rd");
  assert.equal(p.providerCity, "Freeport");
  assert.equal(p.providerState, "NY");
  assert.equal(p.providerType, "photographer");
  assert.equal(p.providerId, "ph1");
});

test("no studio: the area is the address line, nothing repeated", () => {
  const a = photographerBookingParams("ph1", { name: "Gio", location: "Long Island, NY", city: "Freeport", state: "NY" }, "dark");
  assert.equal(a.providerAddress, "Long Island, NY");
  assert.equal(a.providerCity, null);
  assert.equal(a.providerState, null);
  const b = photographerBookingParams("ph1", { name: "Gio", city: "Austin", state: "TX" }, "dark");
  assert.equal(b.providerAddress, "Austin, TX");
  const c = photographerBookingParams("ph1", { name: "Gio" }, "dark");
  assert.equal(c.providerAddress, null);
});

test("terms, color and the tapped service", () => {
  const p = photographerBookingParams("ph1", { name: "Gio", vendorTermsAndConditions: "No raw files." }, "light", "svc9");
  assert.equal(p.providerVendorTerms, "No raw files.");
  assert.equal(p.preselectedServiceId, "svc9");
  assert.match(p.accentColor, /^#[0-9A-Fa-f]{6}$/);
  assert.equal("preselectedServiceId" in photographerBookingParams("ph1", null, "dark"), false);
});
