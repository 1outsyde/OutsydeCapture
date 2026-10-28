/**
 * Optional stock — run with: npx tsx utils/productStock.test.ts
 */
import assert from "node:assert/strict";
import {
  customerStock,
  stockLabel,
  stockModeOf,
  stockPayload,
} from "./productStock";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

test("mode from what is saved", () => {
  assert.equal(stockModeOf({ inventory: 5, trackInventory: true }), "count");
  assert.equal(stockModeOf({ inventory: 0, trackInventory: true }), "soldout");
  assert.equal(
    stockModeOf({ inventory: 0, trackInventory: false }),
    "unlimited",
  );
  assert.equal(
    stockModeOf({ inventory: null, trackInventory: true }),
    "unlimited",
  );
  assert.equal(stockModeOf({ inventory: 12 }), "count");
  assert.equal(stockModeOf(null), "unlimited");
});
test("payloads", () => {
  assert.deepEqual(stockPayload("unlimited", "40"), {
    inventory: null,
    trackInventory: false,
  });
  assert.deepEqual(stockPayload("soldout", ""), {
    inventory: 0,
    trackInventory: true,
  });
  assert.deepEqual(stockPayload("count", "12"), {
    inventory: 12,
    trackInventory: true,
  });
  assert.ok("error" in stockPayload("count", ""));
  assert.ok("error" in stockPayload("count", "0"));
  assert.ok("error" in stockPayload("count", "2.5"));
});
test("customer stock follows checkout", () => {
  assert.equal(customerStock({ inventory: 0, trackInventory: false }), null);
  assert.equal(customerStock({ inventory: null, trackInventory: true }), null);
  assert.equal(customerStock({ inventory: 0, trackInventory: true }), 0);
  assert.equal(customerStock({ inventory: 3 }), 3);
});
test("labels for the business", () => {
  assert.equal(
    stockLabel({ inventory: null, trackInventory: false }),
    "No limit",
  );
  assert.equal(stockLabel({ inventory: 0, trackInventory: true }), "Sold out");
  assert.equal(
    stockLabel({ inventory: 8, trackInventory: true }),
    "8 in stock",
  );
});

console.log(`\n${passed} passed`);
