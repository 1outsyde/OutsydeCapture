import test from "node:test";
import assert from "node:assert/strict";
import {
  money,
  describeAttach,
  keepsLibraryOnAfterTurnOff,
  countPriceReviews,
} from "./addonLibrary";
import type { LibraryAddon } from "@/services/api";

const svc = (
  serviceId: string,
  isActive: boolean,
  needsPriceReview = false,
) => ({
  serviceId,
  serviceName: serviceId,
  serviceStatus: "live",
  addonId: `a-${serviceId}`,
  priceCents: 900,
  isActive,
  priceSynced: !needsPriceReview,
  needsPriceReview,
});
const addon = (services: ReturnType<typeof svc>[]): LibraryAddon => ({
  id: "lib",
  name: "French Tips",
  description: null,
  priceCents: 900,
  durationMinutes: 0,
  isActive: true,
  sortOrder: 0,
  services,
});

test("money formats cents", () => {
  assert.equal(money(1200), "$12.00");
  assert.equal(money(5), "$0.05");
});

test("describeAttach summarises added and skipped services", () => {
  const names: Record<string, string> = {
    full: "Full Set",
    fill: "Fill",
    gel: "Gel Manicure",
  };
  assert.equal(
    describeAttach(
      {
        added: ["full", "gel"],
        skipped: [{ serviceId: "fill", reason: "already_added" }],
      },
      (id) => names[id],
    ),
    "Added to 2 services. Skipped Fill (already has it).",
  );
  assert.equal(
    describeAttach({ added: ["full"], skipped: [] }, (id) => names[id]),
    "Added to 1 service.",
  );
  assert.equal(
    describeAttach(
      { added: [], skipped: [{ serviceId: "gel", reason: "limit" }] },
      (id) => names[id],
    ),
    "Not added to any new service. Skipped Gel Manicure (already has 20 add-ons).",
  );
});

test("library stays on while any service still offers it", () => {
  const a = addon([svc("full", true), svc("gel", true), svc("fill", false)]);
  assert.equal(keepsLibraryOnAfterTurnOff(a, ["gel"]), true);
  assert.equal(keepsLibraryOnAfterTurnOff(a, ["gel", "full"]), false);
});

test("counts services waiting for a price decision", () => {
  assert.equal(
    countPriceReviews([
      addon([svc("full", true, true), svc("gel", true)]),
      addon([svc("fill", true, true)]),
    ]),
    2,
  );
});
