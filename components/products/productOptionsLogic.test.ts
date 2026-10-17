/**
 * Product options editor logic — run with: npx tsx components/products/productOptionsLogic.test.ts
 *
 * Part 1 (always): pure logic, no network.
 * Part 2 (only when PO_APP_TEST_BASE_URL + PO_APP_TEST_PG_URL point at a LOCAL backend and scratch
 * database with migration 049, and JWT_SECRET matches the server): sends the bodies this editor
 * builds to the real PUT /api/business/products/:id/options and reads them back, proving the app
 * and server agree. Refuses any non-local host.
 */
import assert from "node:assert/strict";
import {
  buildSaveBody,
  combosOf,
  initialState,
  keyOf,
  type OptionDraft,
  type RowDraft,
} from "./productOptionsLogic";

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}
const opt = (name: string, values: string[]): OptionDraft => ({
  key: name,
  name,
  values: values.map((value) => ({ value })),
  newValue: "",
});

(async () => {
  console.log("productOptionsLogic");

  await test("combinations follow option order", () => {
    assert.deepEqual(
      combosOf([opt("Color", ["Black", "Cream"]), opt("Size", ["M", "XL"])]),
      [
        ["Black", "M"],
        ["Black", "XL"],
        ["Cream", "M"],
        ["Cream", "XL"],
      ],
    );
  });

  await test("options without a name or values are left out of combinations", () => {
    assert.deepEqual(
      combosOf([opt("Color", ["Black"]), opt("", ["x"]), opt("Size", [])]),
      [["Black"]],
    );
  });

  await test("blank price and stock become null (use product price and stock)", () => {
    const r = buildSaveBody([opt("Color", ["Black"])], {});
    assert.ok("body" in r);
    assert.deepEqual(r.body.variants[0], {
      option1: "Black",
      option2: null,
      option3: null,
      priceCents: null,
      inventory: null,
      imageUrl: null,
      isActive: true,
    });
  });

  await test("typed price and stock are sent in cents and whole numbers", () => {
    const rows: Record<string, RowDraft> = {
      [keyOf(['18"'])]: {
        id: "v18",
        priceInput: "155",
        stockInput: "9",
        isActive: true,
        imageUrl: null,
      },
    };
    const r = buildSaveBody([opt("Length", ['18"'])], rows);
    assert.ok("body" in r);
    assert.equal(r.body.variants[0].priceCents, 15500);
    assert.equal(r.body.variants[0].inventory, 9);
    assert.equal(r.body.variants[0].id, "v18");
  });

  await test("19.99 rounds to 1999 cents", () => {
    const r = buildSaveBody([opt("Size", ["M"])], {
      [keyOf(["M"])]: {
        priceInput: "19.99",
        stockInput: "",
        isActive: true,
        imageUrl: null,
      },
    });
    assert.ok("body" in r);
    assert.equal(r.body.variants[0].priceCents, 1999);
  });

  await test("clear messages for a missing name, missing values, duplicate names, bad price, bad stock", () => {
    assert.ok("error" in buildSaveBody([opt("", ["Red"])], {}));
    assert.ok("error" in buildSaveBody([opt("Size", [])], {}));
    assert.ok(
      "error" in buildSaveBody([opt("Size", ["M"]), opt("size", ["L"])], {}),
    );
    assert.ok(
      "error" in
        buildSaveBody([opt("Size", ["M"])], {
          [keyOf(["M"])]: {
            priceInput: "0",
            stockInput: "",
            isActive: true,
            imageUrl: null,
          },
        }),
    );
    assert.ok(
      "error" in
        buildSaveBody([opt("Size", ["M"])], {
          [keyOf(["M"])]: {
            priceInput: "",
            stockInput: "1.5",
            isActive: true,
            imageUrl: null,
          },
        }),
    );
  });

  await test("removing every option sends an empty list (server switches variations off)", () => {
    const r = buildSaveBody([], {});
    assert.ok("body" in r);
    assert.deepEqual(r.body, { options: [], variants: [] });
  });

  await test("loading: option-based rows keyed by combination; label-only ones listed as older variations", () => {
    const s = initialState({
      productPriceCents: 3500,
      options: [
        {
          id: "o2",
          productId: "p",
          position: 2,
          name: "Size",
          values: [{ value: "M" }],
        },
        {
          id: "o1",
          productId: "p",
          position: 1,
          name: "Color",
          values: [{ value: "Black" }],
        },
      ],
      variants: [
        {
          id: "bm",
          productId: "p",
          label: "Black / M",
          priceCents: 3500,
          hasOwnPrice: false,
          inventory: 4,
          trackInventory: true,
          sku: null,
          sortOrder: 0,
          isActive: true,
          createdAt: "",
          option1: "Black",
          option2: "M",
          option3: null,
          imageUrl: null,
        },
        {
          id: "red",
          productId: "p",
          label: "Red",
          priceCents: 2500,
          hasOwnPrice: true,
          inventory: null,
          trackInventory: true,
          sku: null,
          sortOrder: 1,
          isActive: true,
          createdAt: "",
          option1: null,
          option2: null,
          option3: null,
          imageUrl: null,
        },
      ],
    } as any);
    assert.deepEqual(
      s.options.map((o) => o.name),
      ["Color", "Size"],
    ); // sorted by position
    assert.deepEqual(s.rows[keyOf(["Black", "M"])], {
      id: "bm",
      priceInput: "",
      stockInput: "4",
      isActive: true,
      imageUrl: null,
    });
    assert.deepEqual(s.legacyLabels, ["Red"]);
  });

  // ── Part 2: contract with the real backend (local only) ────────────────────
  const BASE = process.env.PO_APP_TEST_BASE_URL;
  const PG_URL = process.env.PO_APP_TEST_PG_URL;
  if (BASE && PG_URL) {
    const isLocal = (u: string) =>
      ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(u).hostname);
    if (!isLocal(BASE) || !isLocal(PG_URL))
      throw new Error("refusing to run against a non-local host");
    console.log("contract with local backend");
    const jwt: any = await import(
      require.resolve("jsonwebtoken", {
        paths: [process.env.PO_APP_TEST_BACKEND_DIR || "."],
      })
    );
    const sign = (jwt.default ?? jwt).sign;
    const pgMod: any = await import(
      require.resolve("pg", {
        paths: [process.env.PO_APP_TEST_BACKEND_DIR || "."],
      })
    );
    const pg = pgMod.default ?? pgMod;
    const db = new pg.Client({ connectionString: PG_URL });
    await db.connect();
    const P = `poapp${Date.now().toString(36)}`;
    const vendor = `${P}-v`,
      biz = `${P}-b`,
      prod = `${P}-p`;
    await db.query(
      `INSERT INTO users (id, username, email, is_vendor) VALUES ($1::varchar,$1::text,$2,true)`,
      [vendor, `${vendor}@t.test`],
    );
    await db.query(
      `INSERT INTO businesses (id, owner_id, name, category, approval_status) VALUES ($1,$2,'App Test','retail','approved')`,
      [biz, vendor],
    );
    await db.query(
      `INSERT INTO vendor_products (id, business_id, name, price, inventory, track_inventory, is_active, status) VALUES ($1,$2,'Raw Straight',12500,50,true,true,'draft')`,
      [prod, biz],
    );
    const token = sign(
      { userId: vendor, isVendor: true, isAdmin: false },
      process.env.JWT_SECRET!,
      { expiresIn: "10m" },
    );
    const call = async (method: string, body?: unknown) => {
      const res = await fetch(`${BASE}/api/business/products/${prod}/options`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: res.status, json: await res.json() };
    };
    try {
      await test("Dia Lux ladder built by the editor saves and reads back identically", async () => {
        const lengths = [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32].map(
          (n) => `${n}"`,
        );
        const prices = [
          "",
          "135",
          "145",
          "155",
          "165",
          "175",
          "185",
          "195",
          "205",
          "225",
          "235",
        ]; // 12" blank = product price $125
        const rows: Record<string, RowDraft> = {};
        lengths.forEach((l, i) => {
          rows[keyOf([l])] = {
            priceInput: prices[i],
            stockInput: i === 9 ? "0" : "5",
            isActive: true,
            imageUrl: null,
          };
        });
        const built = buildSaveBody([opt("Length", lengths)], rows);
        assert.ok("body" in built);
        const saved = await call("PUT", built.body);
        assert.equal(saved.status, 200, JSON.stringify(saved.json));
        const loaded = await call("GET");
        const state = initialState(loaded.json);
        assert.deepEqual(
          state.options.map((o) => o.values.map((v) => v.value)),
          [lengths],
        );
        assert.equal(state.rows[keyOf(['12"'])].priceInput, ""); // still follows product price
        assert.equal(state.rows[keyOf(['30"'])].priceInput, "225.00");
        assert.equal(state.rows[keyOf(['30"'])].stockInput, "0");
        assert.equal(
          loaded.json.variants.find((v: any) => v.label === '12"').priceCents,
          12500,
        );
        // Saving the reloaded state again changes nothing (ids kept, same rows).
        const again = buildSaveBody(state.options, state.rows);
        assert.ok("body" in again);
        assert.ok(again.body.variants.every((v) => !!v.id));
        const resaved = await call("PUT", again.body);
        assert.equal(resaved.status, 200);
        assert.equal(
          resaved.json.variants.filter((v: any) => v.isActive).length,
          11,
        );
      });

      await test("Color x Size then removing a color: removed rows come back switched off", async () => {
        const built = buildSaveBody(
          [opt("Color", ["Black", "Cream"]), opt("Size", ["M", "XL"])],
          {},
        );
        assert.ok("body" in built);
        const a = await call("PUT", built.body);
        assert.equal(a.status, 200, JSON.stringify(a.json));
        const s1 = initialState(a.json);
        const fewer = buildSaveBody(
          [opt("Color", ["Black"]), opt("Size", ["M", "XL"])],
          s1.rows,
        );
        assert.ok("body" in fewer);
        const b = await call("PUT", fewer.body);
        assert.equal(b.status, 200);
        const active = b.json.variants
          .filter((v: any) => v.isActive)
          .map((v: any) => v.label)
          .sort();
        assert.deepEqual(active, ["Black / M", "Black / XL"]);
        const s2 = initialState(b.json);
        assert.equal(s2.rows[keyOf(["Cream", "M"])].isActive, false); // kept, switched off
      });
    } finally {
      await db.query(`DELETE FROM product_variants WHERE product_id=$1`, [
        prod,
      ]);
      await db.query(`DELETE FROM product_options WHERE product_id=$1`, [prod]);
      await db.query(`DELETE FROM vendor_products WHERE id=$1`, [prod]);
      await db.query(`DELETE FROM businesses WHERE id=$1`, [biz]);
      await db.query(`DELETE FROM users WHERE id=$1`, [vendor]);
      await db.end();
    }
  } else {
    console.log(
      "  (contract part skipped: set PO_APP_TEST_BASE_URL + PO_APP_TEST_PG_URL to a local backend)",
    );
  }

  console.log(`\n${passed} passed`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
