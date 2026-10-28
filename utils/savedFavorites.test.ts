/**
 * One Saved place — run with: npx tsx utils/savedFavorites.test.ts
 */
import assert from "node:assert/strict";
import {
  canClearLegacy,
  favoritesFromServer,
  legacyImportItems,
  productSaveTarget,
  profileSaveTarget,
  savedCounts,
  savedOpenTarget,
  searchSaveTarget,
} from "./savedFavorites";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

test("server list", () => {
  const items = favoritesFromServer({
    favorites: [
      { type: "business", id: "b1", name: "Bakery", image: null, subtitle: "Food · Freeport, NY", savedAt: "2026-10-01T00:00:00.000Z" },
      { type: "product", id: "p1", name: "Cookies", image: "https://i/c.jpg", subtitle: "Bakery", savedAt: "2026-10-02T00:00:00.000Z", businessId: "b1", priceCents: 1200 },
      { type: "post", id: "x" },
      null,
    ],
  });
  assert.equal(items.length, 2);
  assert.equal(items[0].image, "");
  assert.equal(items[1].businessId, "b1");
  assert.equal(items[1].priceCents, 1200);
  assert.deepEqual(favoritesFromServer({}), []);
  assert.deepEqual(favoritesFromServer(null), []);
});

test("phone list import: business entries are also tried as products", () => {
  const out = legacyImportItems([
    { id: "b1", type: "business", name: "A", image: "", savedAt: "2026-01-01T00:00:00Z" },
    { id: "ph1", type: "photographer", name: "P", image: "", savedAt: "2026-01-02T00:00:00Z" },
    { id: "b1", type: "business", name: "A again", image: "" },
    { id: 7, type: "product", name: "X", image: "" },
    { id: "z", type: "post" },
  ]);
  assert.deepEqual(out, [
    { type: "business", id: "b1", savedAt: "2026-01-01T00:00:00Z" },
    { type: "product", id: "b1", savedAt: "2026-01-01T00:00:00Z" },
    { type: "photographer", id: "ph1", savedAt: "2026-01-02T00:00:00Z" },
    { type: "product", id: "7" },
  ]);
  assert.deepEqual(legacyImportItems("junk"), []);
});

test("phone list is cleared only after both one-time moves", () => {
  assert.equal(canClearLegacy("2026", "2026"), true);
  assert.equal(canClearLegacy("2026", null), false, "posts not moved yet: SavedPosts still reads the list");
  assert.equal(canClearLegacy(null, "2026"), false);
});

test("search bookmark saves the right type", () => {
  const base = { name: "N", avatar: "https://a", city: "Freeport", state: "NY" };
  assert.deepEqual(searchSaveTarget({ ...base, id: "b1", resultType: "business" }), {
    id: "b1", type: "business", name: "N", image: "https://a", subtitle: "Freeport, NY",
  });
  assert.equal(searchSaveTarget({ ...base, id: "ph", resultType: "photographer" })?.type, "photographer");
  const p = searchSaveTarget({ ...base, id: "p1", resultType: "product", productImage: "https://pi", businessId: "b1", businessName: "Bakery", price: 900 });
  assert.deepEqual(p, { id: "p1", type: "product", name: "N", image: "https://pi", subtitle: "Bakery", businessId: "b1", priceCents: 900 });
  const s = searchSaveTarget({ ...base, id: "s1", resultType: "service", businessId: "b9", businessName: "Braids" });
  assert.equal(s?.type, "business");
  assert.equal(s?.id, "b9", "a service saves its business");
  assert.equal(searchSaveTarget({ ...base, id: "s2", resultType: "service" }), null);
  assert.equal(searchSaveTarget({ ...base, id: "s3", resultType: "service", businessId: "b", providerType: "photographer" }), null);
  assert.equal(searchSaveTarget({ ...base, id: "u", resultType: "consumer" }), null);
  assert.equal(searchSaveTarget({ ...base, id: "st", resultType: "staff" }), null);
  assert.equal(searchSaveTarget({ id: "b", resultType: "business", city: "Unknown", state: "" })?.subtitle, undefined);
});

test("saved row opens its page", () => {
  assert.deepEqual(savedOpenTarget({ id: "b1", type: "business", name: "B", image: "", savedAt: "" }), {
    screen: "VendorDetail", params: { vendorId: "b1" },
  });
  assert.deepEqual(savedOpenTarget({ id: "ph", type: "photographer", name: "P", image: "", savedAt: "" }).screen, "VendorDetail");
  assert.deepEqual(savedOpenTarget({ id: "p1", type: "product", name: "C", image: "https://i", savedAt: "", businessId: "b1", priceCents: 1200 }), {
    screen: "ProductDetail", params: { id: "p1", businessId: "b1", name: "C", priceCents: 1200, imageUrl: "https://i" },
  });
});

test("counts", () => {
  assert.deepEqual(
    savedCounts(3, [
      { id: "a", type: "business", name: "", image: "", savedAt: "" },
      { id: "b", type: "product", name: "", image: "", savedAt: "" },
      { id: "c", type: "product", name: "", image: "", savedAt: "" },
    ]),
    { posts: 3, business: 1, photographer: 0, product: 2 },
  );
});

test("save button on a business or photographer page", () => {
  const biz = { id: "b1", role: "business", name: "Bakery", avatarUrl: "https://a", location: "Freeport, NY" };
  assert.deepEqual(profileSaveTarget(biz, false), { id: "b1", type: "business", name: "Bakery", image: "https://a", subtitle: "Freeport, NY" });
  assert.equal(profileSaveTarget({ ...biz, role: "photographer" }, false)?.type, "photographer");
  assert.equal(profileSaveTarget({ ...biz, avatarUrl: null, logoImage: "https://l" }, false)?.image, "https://l");
  assert.equal(profileSaveTarget(biz, true), null, "own page: no button");
  assert.equal(profileSaveTarget({ ...biz, role: "consumer" }, false), null, "people: follow, not save");
  assert.equal(profileSaveTarget(null, false), null);
  assert.equal(profileSaveTarget({ ...biz, id: "" }, false), null);
});

test("save button on a product page", () => {
  const p = { id: "p1", businessId: "b1", name: "Cake", imageUrl: "https://i", priceCents: 1200 };
  assert.deepEqual(productSaveTarget(p, null), { id: "p1", type: "product", name: "Cake", image: "https://i", businessId: "b1", priceCents: 1200 });
  assert.equal(productSaveTarget(p, "b1"), null, "the business's own product: no button");
  assert.equal(productSaveTarget(p, "b2")?.id, "p1");
  assert.equal(productSaveTarget({ ...p, id: "" }), null);
});

console.log(`\n${passed} passed`);
