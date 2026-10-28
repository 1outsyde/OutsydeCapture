/**
 * Product add-ons logic — run with: npx tsx components/products/productAddonLogic.test.ts
 */
import assert from "node:assert/strict";
import {
  addonsLabel,
  addonsPerUnitCents,
  cartLineKey,
  checkoutAddons,
  draftChoice,
  draftGroup,
  draftsFrom,
  emptyPicks,
  groupHint,
  lineDetail,
  missingPick,
  pickedAddons,
  priceInputToCents,
  saveBodyFrom,
  setPickText,
  togglePick,
  type PublicAddonGroup,
} from "./productAddonLogic";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

const choice = (
  id: string,
  name: string,
  priceCents: number,
  text?: { label?: string; max?: number },
) => ({
  id,
  name,
  description: null,
  priceCents,
  acceptsText: !!text,
  textLabel: text?.label ?? null,
  textMaxLength: text?.max ?? 40,
});
const groups: PublicAddonGroup[] = [
  {
    id: "g1",
    name: "Flavor",
    minSelect: 1,
    maxSelect: 1,
    required: true,
    addons: [choice("a1", "Vanilla", 0), choice("a2", "Chocolate", 300)],
  },
  {
    id: "g2",
    name: "Toppings",
    minSelect: 0,
    maxSelect: 2,
    required: false,
    addons: [
      choice("b1", "Sprinkles", 200),
      choice("b2", "Fruit", 500),
      choice("b3", "Nuts", 150),
    ],
  },
  {
    id: "g3",
    name: "Message",
    minSelect: 0,
    maxSelect: null,
    required: false,
    addons: [
      choice("c1", "Name frosting", 400, {
        label: "Name on the cake",
        max: 10,
      }),
    ],
  },
];

console.log("picker");
test("required group blocks until picked", () => {
  assert.equal(missingPick(groups, emptyPicks()), "Choose flavor");
});
test("pick one swaps the choice", () => {
  let p = togglePick(groups, emptyPicks(), "a1").picks;
  p = togglePick(groups, p, "a2").picks;
  assert.deepEqual(p.ids, ["a2"]);
});
test("tapping a picked choice removes it", () => {
  const p = togglePick(
    groups,
    togglePick(groups, emptyPicks(), "b1").picks,
    "b1",
  ).picks;
  assert.deepEqual(p.ids, []);
});
test("group limit stops the third topping", () => {
  let p = emptyPicks();
  p = togglePick(groups, p, "b1").picks;
  p = togglePick(groups, p, "b2").picks;
  const r = togglePick(groups, p, "b3");
  assert.equal(r.limitReached, true);
  assert.deepEqual(r.picks.ids, ["b1", "b2"]);
});
test("text choice needs its text, within the limit", () => {
  let p = togglePick(
    groups,
    togglePick(groups, emptyPicks(), "a1").picks,
    "c1",
  ).picks;
  assert.equal(missingPick(groups, p), "Fill in Name on the cake");
  p = setPickText(p, "c1", "Happy birthday Mia");
  assert.equal(
    missingPick(groups, p),
    "Name on the cake can be up to 10 characters",
  );
  p = setPickText(p, "c1", "  Mia\n5 ");
  assert.equal(missingPick(groups, p), null);
});
test("picked list in group then choice order, text cleaned, unit price", () => {
  let p = emptyPicks();
  for (const id of ["c1", "b2", "a2", "b1"])
    p = togglePick(groups, p, id).picks;
  p = setPickText(p, "c1", " Mia\n5 ");
  const list = pickedAddons(groups, p);
  assert.deepEqual(
    list.map((a) => a.addonId),
    ["a2", "b1", "b2", "c1"],
  );
  assert.equal(list[3].text, "Mia 5");
  assert.equal(list[0].text, undefined);
  assert.equal(addonsPerUnitCents(list), 300 + 200 + 500 + 400);
  assert.equal(
    addonsLabel(list),
    'Chocolate, Sprinkles, Fruit, Name frosting: "Mia 5"',
  );
  assert.deepEqual(checkoutAddons(list), [
    { addonId: "a2" },
    { addonId: "b1" },
    { addonId: "b2" },
    { addonId: "c1", text: "Mia 5" },
  ]);
});
test("hints", () => {
  assert.equal(groupHint({ minSelect: 1, maxSelect: 1 }), "Pick 1");
  assert.equal(groupHint({ minSelect: 0, maxSelect: 2 }), "Optional, up to 2");
  assert.equal(groupHint({ minSelect: 0, maxSelect: null }), "Optional");
  assert.equal(groupHint({ minSelect: 1, maxSelect: null }), "Pick at least 1");
  assert.equal(groupHint({ minSelect: 0, maxSelect: 1 }), "Optional, pick 1");
});

console.log("cart line");
test("no add-ons list keeps the old key (saved carts still match)", () => {
  assert.equal(cartLineKey("p1", "v1"), "p1::v1");
  assert.equal(cartLineKey("p1"), "p1::");
});
test("different add-ons are different lines, same picks in any order are one", () => {
  const a = [
    { addonId: "x", groupName: "G", name: "X", priceCents: 1 },
    { addonId: "y", groupName: "G", name: "Y", priceCents: 1, text: "Hi" },
  ];
  const b = [a[1], a[0]];
  assert.equal(cartLineKey("p", undefined, a), cartLineKey("p", undefined, b));
  assert.notEqual(
    cartLineKey("p", undefined, a),
    cartLineKey("p", undefined, [a[0]]),
  );
  assert.notEqual(cartLineKey("p", undefined, []), cartLineKey("p"));
  assert.notEqual(
    cartLineKey("p", undefined, [{ ...a[1], text: "Yo" }]),
    cartLineKey("p", undefined, [a[1]]),
  );
});
test("line detail joins variation and add-ons", () => {
  assert.equal(lineDetail("Pink", "Sprinkles"), "Pink · Sprinkles");
  assert.equal(lineDetail(null, "Sprinkles"), "Sprinkles");
  assert.equal(lineDetail(undefined, ""), null);
});

console.log("business editor");
test("price input", () => {
  assert.equal(priceInputToCents(""), 0);
  assert.equal(priceInputToCents("5"), 500);
  assert.equal(priceInputToCents("$5.5"), 550);
  assert.equal(priceInputToCents("5.555"), null);
  assert.equal(priceInputToCents("abc"), null);
  assert.equal(priceInputToCents("1000.01"), null);
});
test("untouched new group is dropped", () => {
  const r = saveBodyFrom([draftGroup()]);
  assert.deepEqual(r, { body: { groups: [] } });
});
test("full save body", () => {
  const r = saveBodyFrom([
    draftGroup({
      name: " Toppings ",
      rule: "upTo",
      upToInput: "2",
      required: false,
      choices: [
        draftChoice({ name: "Sprinkles", priceInput: "2" }),
        draftChoice({ name: "Fruit", priceInput: "5.00" }),
        draftChoice(),
      ],
    }),
    draftGroup({
      name: "Message",
      rule: "one",
      required: true,
      choices: [
        draftChoice({
          name: "Name frosting",
          priceInput: "4",
          acceptsText: true,
          textLabel: "Name",
          textMaxInput: "",
        }),
      ],
    }),
  ]);
  assert.ok("body" in r);
  const [g1, g2] = (r as any).body.groups;
  assert.deepEqual(
    [g1.name, g1.minSelect, g1.maxSelect, g1.addons.length],
    ["Toppings", 0, 2, 2],
  );
  assert.deepEqual(
    [
      g2.minSelect,
      g2.maxSelect,
      g2.addons[0].textMaxLength,
      g2.addons[0].textLabel,
    ],
    [1, 1, 40, "Name"],
  );
  assert.equal(g1.addons[0].priceCents, 200);
  assert.equal("id" in g1, false);
});
test("problems are caught before saving", () => {
  assert.match(
    (
      saveBodyFrom([
        draftGroup({ name: "", choices: [draftChoice({ name: "X" })] }),
      ]) as any
    ).error,
    /needs a name/,
  );
  assert.match(
    (
      saveBodyFrom([
        draftGroup({
          name: "G",
          choices: [draftChoice({ name: "X" }), draftChoice({ name: "x" })],
        }),
      ]) as any
    ).error,
    /listed twice/,
  );
  assert.match(
    (
      saveBodyFrom([
        draftGroup({
          name: "G",
          choices: [draftChoice({ name: "X", priceInput: "1.234" })],
        }),
      ]) as any
    ).error,
    /price/,
  );
  assert.match(
    (
      saveBodyFrom([
        draftGroup({
          name: "G",
          rule: "upTo",
          upToInput: "0",
          choices: [draftChoice({ name: "X" })],
        }),
      ]) as any
    ).error,
    /up to/,
  );
  assert.match(
    (
      saveBodyFrom([
        draftGroup({
          name: "G",
          required: true,
          choices: [draftChoice({ name: "X", isActive: false })],
        }),
      ]) as any
    ).error,
    /required/,
  );
  assert.match(
    (
      saveBodyFrom([
        draftGroup({
          name: "G",
          choices: [
            draftChoice({ name: "X", acceptsText: true, textMaxInput: "500" }),
          ],
        }),
      ]) as any
    ).error,
    /letter limit/,
  );
  assert.match(
    (saveBodyFrom([draftGroup({ name: "G", choices: [] })]) as any).error,
    /at least one choice/,
  );
});
test("loaded groups round-trip with ids, library pick sends only businessAddonId", () => {
  const drafts = draftsFrom([
    {
      id: "G1",
      name: "Toppings",
      minSelect: 1,
      maxSelect: null,
      isActive: true,
      addons: [
        {
          id: "A1",
          name: "Sprinkles",
          description: null,
          priceCents: 250,
          acceptsText: false,
          textLabel: null,
          textMaxLength: 40,
          isActive: true,
          businessAddonId: "L1",
          priceSynced: true,
          libraryPriceCents: 250,
          needsPriceReview: false,
        },
      ],
    },
  ]);
  assert.equal(drafts[0].required, true);
  assert.equal(drafts[0].rule, "any");
  assert.equal(drafts[0].choices[0].priceInput, "2.50");
  drafts[0].choices.push(
    draftChoice({ name: "Fruit", priceInput: "5", businessAddonId: "L2" }),
  );
  const r: any = saveBodyFrom(drafts);
  assert.equal(r.body.groups[0].id, "G1");
  assert.deepEqual(
    [r.body.groups[0].addons[0].id, r.body.groups[0].addons[0].businessAddonId],
    ["A1", undefined],
  );
  assert.deepEqual(
    [r.body.groups[0].addons[1].id, r.body.groups[0].addons[1].businessAddonId],
    [undefined, "L2"],
  );
});

console.log(`\n${passed} passed`);
