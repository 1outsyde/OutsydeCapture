import test from "node:test";
import assert from "node:assert/strict";
import {
  outsydeAppearance,
  toStripeHex,
  STRIPE_RETURN_URL,
  googlePayTestEnv,
} from "./outsydePaymentAppearance";

test("solid hex colors pass through unchanged", () => {
  assert.equal(toStripeHex("#B38600", "#FFFFFF"), "#B38600");
  assert.equal(toStripeHex("#1a3c34", "#FFFFFF"), "#1A3C34");
});

test("see-through theme colors become solid hex over their background (Stripe only takes #RRGGBB)", () => {
  assert.equal(toStripeHex("rgba(0,0,0,0.08)", "#FFFFFF"), "#EBEBEB");
  assert.equal(toStripeHex("rgba(255,255,255,0.04)", "#111411"), "#1B1D1B");
  assert.equal(toStripeHex("rgba(255,255,255,0.08)", "#111411"), "#242724");
  assert.equal(toStripeHex("rgba(200,191,168,0.6)", "#111411"), "#7F7B6C");
});

test("light mode uses the app's exact light brand colors", () => {
  const a = outsydeAppearance("light");
  assert.deepEqual(a.colors, {
    primary: "#B38600",
    background: "#FFFFFF",
    componentBackground: "#FFFFFF",
    componentBorder: "#EBEBEB",
    componentDivider: "#EBEBEB",
    primaryText: "#0A0A0A",
    secondaryText: "#555555",
    componentText: "#0A0A0A",
    placeholderText: "#555555",
    icon: "#555555",
    error: "#FF3B30",
  });
  assert.deepEqual(a.primaryButton, {
    colors: { background: "#1A3C34", text: "#FFFFFF" },
    shapes: { borderRadius: 12 },
  });
  assert.deepEqual(a.shapes, { borderRadius: 12 });
});

test("dark mode uses the app's exact dark brand colors, made solid", () => {
  const a = outsydeAppearance("dark");
  assert.deepEqual(a.colors, {
    primary: "#E8B930",
    background: "#111411",
    componentBackground: "#1B1D1B",
    componentBorder: "#242724",
    componentDivider: "#242724",
    primaryText: "#F0EAD6",
    secondaryText: "#7F7B6C",
    componentText: "#F0EAD6",
    placeholderText: "#7F7B6C",
    icon: "#7F7B6C",
    error: "#FF3B30",
  });
  assert.deepEqual(a.primaryButton, {
    colors: { background: "#1A3C34", text: "#F0EAD6" },
    shapes: { borderRadius: 12 },
  });
});

test("every color handed to Stripe is #RRGGBB", () => {
  for (const scheme of ["light", "dark"] as const) {
    const a = outsydeAppearance(scheme);
    for (const v of [
      ...Object.values(a.colors),
      a.primaryButton.colors.background,
      a.primaryButton.colors.text,
    ]) {
      assert.match(v, /^#[0-9A-F]{6}$/, `${scheme}: ${v}`);
    }
  }
});

test("the return link avoids the words other link handlers react to", () => {
  assert.equal(STRIPE_RETURN_URL, "outsyde://stripe-redirect");
  assert.ok(!STRIPE_RETURN_URL.includes("stripe-return"));
  assert.ok(!STRIPE_RETURN_URL.includes("checkout"));
  assert.ok(!STRIPE_RETURN_URL.includes("reset-password"));
});

test("Google Pay test mode follows the Stripe key", () => {
  assert.equal(googlePayTestEnv("pk_test_123"), true);
  assert.equal(googlePayTestEnv("pk_live_123"), false);
  assert.equal(googlePayTestEnv(""), true);
  assert.equal(googlePayTestEnv(undefined), true);
});
