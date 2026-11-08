// Payment methods Step 5: the server address comes from the build profile (EXPO_PUBLIC_API_URL) so a Stripe
// test build can point at the test backend. App Store builds set nothing and keep production.
// Run: npx tsx utils/apiBaseUrl.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PRODUCTION_API_URL, resolveApiBaseUrl } from "./apiBaseUrl";

test("no setting (every current build profile): production", () => {
  assert.equal(PRODUCTION_API_URL, "https://outsyde-backend.onrender.com");
  assert.equal(resolveApiBaseUrl(undefined), PRODUCTION_API_URL);
  assert.equal(resolveApiBaseUrl(""), PRODUCTION_API_URL);
  assert.equal(resolveApiBaseUrl("   "), PRODUCTION_API_URL);
});

test("a test build's https address is used, without a trailing slash", () => {
  assert.equal(
    resolveApiBaseUrl("https://outsyde-backend-test.onrender.com"),
    "https://outsyde-backend-test.onrender.com",
  );
  assert.equal(
    resolveApiBaseUrl(" https://outsyde-backend-test.onrender.com/ "),
    "https://outsyde-backend-test.onrender.com",
  );
  assert.equal(
    resolveApiBaseUrl("https://outsyde-backend-test.onrender.com//"),
    "https://outsyde-backend-test.onrender.com",
  );
});

test("anything that isn't a plain https origin falls back to production", () => {
  for (const bad of [
    "http://outsyde-backend-test.onrender.com",
    "outsyde-backend-test.onrender.com",
    "https://outsyde-backend-test.onrender.com/api",
    "https://exa mple.com",
    "https://",
    "javascript:alert(1)",
  ])
    assert.equal(resolveApiBaseUrl(bad), PRODUCTION_API_URL, bad);
});

test("the production address is written in one place only (utils/apiBaseUrl.ts)", () => {
  const root = join(__dirname, "..");
  const skip = new Set([
    "node_modules",
    ".git",
    "attached_assets",
    "docs",
    ".expo",
    "dist",
    "ios",
    "android",
  ]);
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (
        /\.(ts|tsx|js|jsx)$/.test(name) &&
        !/\.test\.tsx?$/.test(name) &&
        !p.endsWith(join("utils", "apiBaseUrl.ts"))
      )
        if (readFileSync(p, "utf8").includes("outsyde-backend.onrender.com"))
          hits.push(p.slice(root.length + 1));
    }
  };
  walk(root);
  assert.deepEqual(hits, []);
});
