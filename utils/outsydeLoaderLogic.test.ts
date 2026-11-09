// Tests for the Outsyde branded loader logic (utils/outsydeLoaderLogic.ts).
// Run: npx tsx utils/outsydeLoaderLogic.test.ts
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  DRIPS,
  FADE_OUT,
  LOADER_BLACK,
  LOADER_SIZES,
  LOGO_PX,
  MIN_SPRAY_SIZE,
  SETTLE,
  STROKES,
  LAUNCH_MAX_MS,
  LAUNCH_MIN_MS,
  LAUNCH_MIN_REDUCED_MS,
  easeInOut,
  launchShouldHide,
  loaderColors,
  phase,
  strokeRect,
} from "./outsydeLoaderLogic";

// phase: clamps and maps
assert.equal(phase(-1, 0, 0.5), 0);
assert.equal(phase(0.25, 0, 0.5), 0.5);
assert.equal(phase(2, 0, 0.5), 1);
assert.equal(phase(0.5, 0.5, 0.5), 1);
assert.equal(phase(0.4, 0.5, 0.5), 0);

// easeInOut: ends fixed, symmetric
assert.equal(easeInOut(0), 0);
assert.equal(easeInOut(1), 1);
assert.equal(easeInOut(0.5), 0.5);

// timing order matches the preview: strokes in sequence, drips, settle, fade
for (let i = 1; i < STROKES.length; i++) assert.ok(STROKES[i].from >= STROKES[i - 1].to - 1e-9, `stroke ${i} order`);
for (const d of DRIPS) assert.ok(d.from >= STROKES[STROKES.length - 1].to - 1e-9, "drips after strokes");
assert.ok(SETTLE.from >= Math.max(...DRIPS.map((d) => d.from)), "settle after drips start");
assert.ok(FADE_OUT.from > SETTLE.to && FADE_OUT.to === 1, "fade out last");

// geometry: counter rotation puts every logo pixel back where it belongs.
// A point P (image coords) is rotated -a about pivot inside the clip, the
// clip is rotated +a about the same screen point: net identity.
function rot(x: number, y: number, cx: number, cy: number, deg: number) {
  const r = (deg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx + dx * Math.cos(r) - dy * Math.sin(r), y: cy + dx * Math.sin(r) + dy * Math.cos(r) };
}
for (const scale of [176 / LOGO_PX, 96 / LOGO_PX, 1]) {
  for (const s of STROKES) {
    const r = strokeRect(s, scale);
    // clip pivot on screen = clip (left, top + height/2); image pivot inside it
    const pivot = { x: r.left, y: r.top + r.height / 2 };
    assert.ok(Math.abs(r.imageLeft + r.pivotX - 0) < 1e-9, "image pivot x at clip pivot");
    assert.ok(Math.abs(r.imageTop + r.pivotY - r.height / 2) < 1e-9, "image pivot y at clip pivot");
    for (const p of [{ x: 0, y: 0 }, { x: 300, y: 200 }, { x: LOGO_PX * scale, y: LOGO_PX * scale }]) {
      // image local -> rotate -a about image pivot -> offset into clip -> clip to screen -> rotate +a
      const a = rot(p.x, p.y, r.pivotX, r.pivotY, -r.angleDeg);
      const inScreen = { x: a.x + r.imageLeft + r.left, y: a.y + r.imageTop + r.top };
      const b = rot(inScreen.x, inScreen.y, pivot.x, pivot.y, r.angleDeg);
      assert.ok(Math.abs(b.x - p.x) < 1e-6 && Math.abs(b.y - p.y) < 1e-6, "logo pixel lands in place");
    }
    // the clip covers the whole stroke, both ends included
    assert.ok(r.length > Math.hypot(s.x1 - s.x0, s.y1 - s.y0) * scale, "clip longer than stroke");
  }
}

// sizes: screen and section spray, button pulses
assert.ok(LOADER_SIZES.screen >= MIN_SPRAY_SIZE);
assert.ok(LOADER_SIZES.section >= MIN_SPRAY_SIZE);
assert.ok(LOADER_SIZES.button < MIN_SPRAY_SIZE);

// colours + contrast (status line must pass 4.5:1)
function lum(hex: string) {
  const n = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const l = c.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
}
function contrast(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
const light = loaderColors("light", "theme");
const dark = loaderColors("dark", "theme");
const emerald = loaderColors("dark", "emerald");
assert.equal(light.background, "#F5F0E6");
assert.equal(dark.background, LOADER_BLACK);
assert.equal(emerald.background, "#1A3C34");
assert.deepEqual(loaderColors("light", "emerald"), emerald, "emerald ignores mode");
for (const [name, c] of Object.entries({ light, dark, emerald })) {
  assert.ok(contrast(c.text, c.background) >= 4.5, `${name} status line contrast ${contrast(c.text, c.background).toFixed(2)}`);
}

// the component uses the logo already in the app and no native package
assert.ok(existsSync("assets/images/outsyde-y-logo.png"), "logo asset present");
const src = readFileSync("components/OutsydeLoader.tsx", "utf8");
assert.ok(!/from\s+["']react-native-svg["']/.test(src), "no react-native-svg import");
assert.ok(src.includes("useReducedMotion"), "honours reduce motion");
assert.ok(src.includes('accessibilityRole="progressbar"'), "screen reader role");

// launch overlay: plays once, waits for the app, never blocks forever
assert.equal(LAUNCH_MIN_MS, 1650);
assert.equal(launchShouldHide(true, LAUNCH_MIN_MS - 1, false), false, "spray finishes first");
assert.equal(launchShouldHide(true, LAUNCH_MIN_MS, false), true);
assert.equal(launchShouldHide(false, 5000, false), false, "waits for the app");
assert.equal(launchShouldHide(false, LAUNCH_MAX_MS, false), true, "hard cap");
assert.equal(launchShouldHide(true, LAUNCH_MIN_REDUCED_MS, true), true, "reduce motion is quick");
assert.ok(LAUNCH_MAX_MS <= 8000);

// native splash: plain emerald both modes, no logo image (spray starts empty);
// the app icon stays the same file
const appJson = JSON.parse(readFileSync("app.json", "utf8")).expo;
const splash = appJson.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-splash-screen")[1];
assert.equal(splash.backgroundColor, "#1A3C34");
assert.equal(splash.dark.backgroundColor, "#1A3C34");
assert.equal(splash.image, undefined, "no image on the native splash");
assert.equal(appJson.icon, "./assets/images/outsyde-icon.png", "app icon unchanged");

// App.tsx mounts the overlay once, driven by navigation readiness
const app = readFileSync("App.tsx", "utf8");
assert.equal((app.match(/<LaunchOverlay /g) ?? []).length, 1, "one launch overlay");
assert.ok(app.includes("onReady={() => setNavReady(true)}"), "ready from NavigationContainer");
const overlay = readFileSync("components/LaunchOverlay.tsx", "utf8");
assert.ok(overlay.includes('pointerEvents={hiding ? "none" : "auto"}'), "lets touches through when hiding");

console.log("outsydeLoaderLogic tests passed");
