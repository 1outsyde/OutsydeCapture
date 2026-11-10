/**
 * Color pass step 1 (Legend 2026-11-10): filled tab bar icons and neutral surface colors.
 * Run with: npx tsx utils/colorPassGuard.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Colors } from "../constants/theme";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok  ${name}`);
}

test("tab bar uses filled Ionicons only", () => {
  const src = read("navigation/MainTabNavigator.tsx");
  assert.ok(!src.includes("Feather"), "no Feather (outline) icons");
  for (const name of ["home", "search", "chatbubble", "person", "add"]) {
    assert.ok(src.includes(`<Ionicons name="${name}"`), name);
  }
  assert.ok(!/name="[a-z-]+-outline"/.test(src), "no outline names");
});

test("surface colors are neutral (no green tint) in both modes", () => {
  for (const mode of ["light", "dark"] as const) {
    const t = Colors[mode] as Record<string, string>;
    for (const key of ["brandScreen", "brandCard", "brandChip"]) {
      const hex = t[key].replace("#", "");
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
      assert.ok(
        g - Math.min(r, b) <= 4,
        `${mode}.${key} ${t[key]} leans green`,
      );
    }
    assert.notEqual(
      t.brandScreen.toUpperCase(),
      "#000000",
      `${mode} background is not pitch black`,
    );
  }
});

console.log(`\n${passed} passed`);
