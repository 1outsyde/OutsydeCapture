/**
 * Request forms step P-b: contact for pricing products in the app (calls Q1 to Q7). Run: npx tsx utils/productRequestLogic.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  PRICE_ON_REQUEST,
  isRequestProduct,
  productCardAction,
  productCardButtonLabel,
  pricedProducts,
  ownerProductPriceLine,
  productRequestOnlyPatch,
  productRequestParams,
  requestItemLabel,
} from "./productRequestLogic";
import { formFromRequest, emptyForm } from "./quoteSendLogic";
import { requestBody, type RequestForm } from "./requestLogic";

test("only requestOnly true is a contact for pricing product", () => {
  assert.equal(isRequestProduct({ requestOnly: true }), true);
  assert.equal(isRequestProduct({ requestOnly: false }), false);
  assert.equal(isRequestProduct({}), false);
  assert.equal(isRequestProduct({ requestOnly: null }), false);
  assert.equal(isRequestProduct(null), false);
  assert.equal(PRICE_ON_REQUEST, "Price on request");
});

test("product card: Request opens the page, never the cart, even when it has options", () => {
  assert.deepEqual(productCardAction({ requestOnly: true }, false), {
    priceOnRequest: true,
    button: "Request",
    opensPage: true,
  });
  assert.deepEqual(productCardAction({ requestOnly: true }, true), {
    priceOnRequest: true,
    button: "Request",
    opensPage: true,
  });
  assert.deepEqual(productCardAction({ requestOnly: false }, true), {
    priceOnRequest: false,
    button: "Choose",
    opensPage: true,
  });
  assert.deepEqual(productCardAction({}, false), {
    priceOnRequest: false,
    button: "Add",
    opensPage: false,
  });
  assert.equal(
    productCardButtonLabel("Custom cake", "Request"),
    "Request a quote for Custom cake",
  );
  assert.equal(productCardButtonLabel("Candle", "Add"), "Add Candle to cart");
  assert.equal(
    productCardButtonLabel("Wig", "Choose"),
    "Choose an option for Wig",
  );
});

test("from $X leaves contact for pricing products out", () => {
  const list = [
    { id: "a", requestOnly: true },
    { id: "b" },
    { id: "c", requestOnly: false },
  ];
  assert.deepEqual(
    pricedProducts(list).map((p) => p.id),
    ["b", "c"],
  );
});

test("owner list and editor field", () => {
  assert.equal(
    ownerProductPriceLine({ requestOnly: true }, "$45"),
    "Contact for pricing",
  );
  assert.equal(ownerProductPriceLine({}, "$45"), "$45");
  assert.deepEqual(
    productRequestOnlyPatch({ touched: false, value: true }),
    {},
  );
  assert.deepEqual(productRequestOnlyPatch({ touched: true, value: true }), {
    requestOnly: true,
  });
  assert.deepEqual(productRequestOnlyPatch({ touched: true, value: false }), {
    requestOnly: false,
  });
});

test("Request a quote params carry the product", () => {
  assert.deepEqual(
    productRequestParams({
      id: "p1",
      name: "Custom cake",
      businessId: "b1",
      businessName: "Sweet",
    }),
    {
      serviceId: "p1",
      serviceName: "Custom cake",
      businessId: "b1",
      businessName: "Sweet",
      productId: "p1",
    },
  );
  assert.equal(
    "businessName" in
      productRequestParams({ id: "p1", name: "x", businessId: "b1" }),
    false,
  );
});

test("a product request sends productId, never serviceId", () => {
  const form: RequestForm = {
    service: { id: "p1", name: "Custom cake" },
    business: { id: "b1", name: "Sweet" },
    itemType: "product",
    cities: [],
    cityRequired: false,
    phoneRequired: true,
    questions: [
      { id: "q1", type: "short_text", label: "Occasion", required: true },
    ],
  };
  const body: any = requestBody(
    form,
    { firstName: "Tasha", email: "t@x.test" },
    { q1: "Birthday" },
    {},
    "516 555 0142",
    "",
  );
  assert.equal(body.productId, "p1");
  assert.equal(body.businessId, "b1");
  assert.equal("serviceId" in body, false);
  assert.equal("photographerId" in body, false);
  const svc: any = requestBody(
    { ...form, itemType: undefined },
    { email: "t@x.test" },
    { q1: "x" },
    {},
    "1",
    "",
  );
  assert.equal(svc.serviceId, "p1");
  assert.equal("productId" in svc, false);
});

test("Send a quote from a product request starts a Deliverable with the product picked", () => {
  const f = formFromRequest({
    requestId: "r1",
    productId: "p1",
    serviceName: " Custom cake ",
    preferredDate: "2026-12-12",
  });
  assert.equal(f.kind, "product");
  assert.equal(f.productId, "p1");
  assert.equal(f.title, "Custom cake");
  assert.equal(f.dueDate, "2026-12-12");
  assert.equal(f.jobDate, "");
  assert.equal(f.serviceId, null);
  assert.equal(f.requestId, "r1");
  const bad = formFromRequest({
    requestId: "r1",
    productId: "p1",
    serviceName: "x",
    preferredDate: "2026-02-31",
  });
  assert.equal(bad.dueDate, "");
  const svc = formFromRequest({
    requestId: "r2",
    serviceId: "s1",
    serviceName: "Move",
    preferredDate: "2026-12-12",
  });
  assert.equal(svc.kind, emptyForm().kind);
  assert.equal(svc.productId, null);
  assert.equal(svc.jobDate, "2026-12-12");
});

test("request rows label products", () => {
  assert.equal(requestItemLabel({ productId: "p1" }), "Product");
  assert.equal(requestItemLabel({ itemType: "product" }), "Product");
  assert.equal(
    requestItemLabel({ productId: null, itemType: "service" }),
    null,
  );
  assert.equal(requestItemLabel({}), null);
});
