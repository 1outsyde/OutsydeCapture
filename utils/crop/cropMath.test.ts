import test from "node:test";
import assert from "node:assert/strict";
import {
  coverScale,
  clampZoom,
  clampOffset,
  cropRectFor,
  outputSizeFor,
  boxSizeFor,
  ratioPair,
  clampAspect,
  centerRectFraction,
  rectFractionOf,
  rectFromFraction,
  viewForFraction,
  cameraFrameFraction,
  MAX_ZOOM,
  openAreaFrame,
  freeAspectFromDrag,
  aspectLabel,
} from "./cropMath";

const landscape = { width: 4032, height: 3024 }; // 4:3 phone photo
const portrait = { width: 3024, height: 4032 };

test("coverScale fills the box on the tight side", () => {
  const box = { width: 300, height: 375 }; // 4:5
  const s = coverScale(landscape, box);
  assert.ok(Math.abs(landscape.height * s - 375) < 1e-9, "height fits exactly");
  assert.ok(landscape.width * s >= 300, "width overflows");
});

test("clampZoom stays between 1 and MAX_ZOOM", () => {
  assert.equal(clampZoom(0.2), 1);
  assert.equal(clampZoom(2.5), 2.5);
  assert.equal(clampZoom(99), MAX_ZOOM);
  assert.equal(clampZoom(Number.NaN), 1);
});

test("clampOffset never lets an edge into the box", () => {
  const box = { width: 300, height: 300 };
  const s = coverScale(landscape, box); // height fits exactly, so no vertical move allowed
  const c = clampOffset(10_000, 10_000, landscape, box, s);
  assert.equal(c.ty, 0);
  assert.ok(Math.abs(c.tx - (landscape.width * s - 300) / 2) < 1e-9);
  const n = clampOffset(-10_000, 0, landscape, box, s);
  assert.equal(n.tx, -c.tx);
});

test("centered crop at cover scale takes the middle of the photo, box shape", () => {
  const box = { width: 300, height: 375 };
  const s = coverScale(landscape, box);
  const r = cropRectFor(landscape, box, s, 0, 0);
  assert.equal(r.height, 3024);
  assert.equal(r.width, Math.round(3024 * 0.8));
  assert.equal(r.originY, 0);
  assert.ok(
    Math.abs(r.originX - (4032 - r.width) / 2) <= 1,
    `centered within 1px (${r.originX})`,
  );
});

test("dragging right shows the left side of the photo", () => {
  const box = { width: 300, height: 300 };
  const s = coverScale(landscape, box);
  const r = cropRectFor(landscape, box, s, 10_000, 0); // clamped to the far right
  assert.equal(r.originX, 0);
  const l = cropRectFor(landscape, box, s, -10_000, 0);
  assert.equal(l.originX + l.width, landscape.width);
});

test("zooming in crops a smaller area, still inside the photo", () => {
  const box = { width: 300, height: 300 };
  const s = coverScale(portrait, box) * 2;
  const r = cropRectFor(portrait, box, s, 0, 0);
  assert.equal(r.width, Math.round(3024 / 2));
  assert.equal(r.height, r.width);
  assert.ok(r.originX >= 0 && r.originY >= 0);
  assert.ok(
    r.originX + r.width <= portrait.width &&
      r.originY + r.height <= portrait.height,
  );
});

test("crop is always whole pixels inside the photo", () => {
  const box = { width: 333, height: 187 }; // ~16:9
  for (const zoom of [1, 1.37, 2.9, MAX_ZOOM]) {
    for (const t of [-999, -13.3, 0, 7.77, 999]) {
      const s = coverScale(landscape, box) * zoom;
      const r = cropRectFor(landscape, box, s, t, -t);
      for (const v of Object.values(r))
        assert.ok(Number.isInteger(v), `integer ${v}`);
      assert.ok(r.originX >= 0 && r.originY >= 0);
      assert.ok(r.originX + r.width <= landscape.width);
      assert.ok(r.originY + r.height <= landscape.height);
      assert.ok(
        Math.abs(r.width / r.height - 333 / 187) < 0.02,
        "same shape as the box",
      );
    }
  }
});

test("outputSizeFor: exact ratio, capped, never upscaled", () => {
  assert.deepEqual(outputSizeFor({ width: 2419, height: 3024 }, 0.8), {
    width: 1080,
    height: 1350,
  });
  assert.deepEqual(outputSizeFor({ width: 3024, height: 3024 }, 1), {
    width: 1080,
    height: 1080,
  });
  assert.deepEqual(outputSizeFor({ width: 4032, height: 2268 }, 16 / 9), {
    width: 1920,
    height: 1080,
  });
  const small = outputSizeFor({ width: 400, height: 500 }, 0.8);
  assert.deepEqual(
    small,
    { width: 400, height: 500 },
    "small photos keep their size",
  );
  const sq = outputSizeFor({ width: 553, height: 555 }, 1);
  assert.equal(sq.width, sq.height);
  // Off-by-one crops from a rounded box still save at the exact shape, never bigger.
  assert.deepEqual(outputSizeFor({ width: 801, height: 1000 }, 0.8), {
    width: 800,
    height: 1000,
  });
  const wide = outputSizeFor({ width: 1596, height: 898 }, 16 / 9);
  assert.equal(wide.width * 9, wide.height * 16);
  assert.ok(wide.width <= 1596 && wide.height <= 898);
  // A ratio that is not a simple fraction still fits inside the crop.
  const odd = outputSizeFor({ width: 1000, height: 700 }, Math.PI / 2);
  assert.ok(odd.width <= 1000 && odd.height <= 700);
});

test("boxSizeFor fits width first, then height", () => {
  assert.deepEqual(boxSizeFor(0.8, 360, 600), { width: 360, height: 450 });
  assert.deepEqual(boxSizeFor(0.5625, 360, 500), { width: 281, height: 500 });
  assert.deepEqual(boxSizeFor(16 / 9, 360, 600), { width: 360, height: 202 });
});

test("ratioPair finds simple fractions", () => {
  assert.deepEqual(ratioPair(0.8), [4, 5]);
  assert.deepEqual(ratioPair(16 / 9), [16, 9]);
  assert.deepEqual(ratioPair(1), [1, 1]);
  assert.deepEqual(ratioPair(9 / 16), [9, 16]);
  assert.equal(ratioPair(Math.PI), null);
});

test("clampAspect keeps post shapes between 4:5 and 1.91:1", () => {
  assert.equal(clampAspect(0.5625), 0.8);
  assert.equal(clampAspect(2.5), 1.91);
  assert.equal(clampAspect(4 / 3), 4 / 3);
  assert.equal(clampAspect(Number.NaN), 0.8);
});

test("centerRectFraction takes the biggest centered crop", () => {
  const r = centerRectFraction(landscape, 1); // 4:3 photo, square crop
  assert.ok(Math.abs(r.w - 0.75) < 1e-9 && r.h === 1);
  assert.ok(Math.abs(r.x - 0.125) < 1e-9 && r.y === 0);
  const t = centerRectFraction(portrait, 16 / 9);
  assert.equal(t.w, 1);
  assert.ok(Math.abs(t.h - (0.75 * 9) / 16) < 1e-9);
});

test("rectFromFraction and rectFractionOf round trip in whole pixels", () => {
  const rect = { originX: 300, originY: 120, width: 2000, height: 2500 };
  const back = rectFromFraction(rectFractionOf(rect, portrait), portrait);
  assert.deepEqual(back, rect);
});

test("viewForFraction reopens a crop where it was left", () => {
  const box = { width: 360, height: 450 };
  for (const frac of [
    centerRectFraction(landscape, 0.8),
    { x: 0.05, y: 0, w: 0.75 * 0.8, h: 1 }, // moved left
    { x: 0.4, y: 0.3, w: 0.3, h: 0.5 }, // zoomed in
  ]) {
    const v = viewForFraction(landscape, box, frac);
    const s = coverScale(landscape, box) * v.zoom;
    const got = rectFractionOf(
      cropRectFor(landscape, box, s, v.tx, v.ty),
      landscape,
    );
    assert.ok(Math.abs(got.x - frac.x) < 0.002, `x ${got.x} vs ${frac.x}`);
    assert.ok(Math.abs(got.y - frac.y) < 0.002, `y ${got.y} vs ${frac.y}`);
    assert.ok(Math.abs(got.w - frac.w) < 0.002, `w ${got.w} vs ${frac.w}`);
  }
});

test("cameraFrameFraction maps the on-screen frame into the photo", () => {
  // 390 x 560 preview, 3:4 photo reported as landscape sensor size.
  const area = { width: 390, height: 560 };
  const photo = { width: 4032, height: 3024 }; // turned upright to 3024 x 4032
  const frame = { left: 16, top: 52.5, width: 358, height: 447.5 }; // 4:5, centered
  const f = cameraFrameFraction(photo, area, frame);
  // Preview covers by height: photo shown 420 wide, so 15 points are cut on each side.
  const s = 560 / 4032;
  assert.ok(Math.abs(f.w - 358 / s / 3024) < 1e-9);
  assert.ok(Math.abs(f.x - (16 + 15) / s / 3024) < 1e-9);
  assert.ok(Math.abs(f.y - 52.5 / 560) < 1e-9);
  // Same shape as the frame, in photo pixels.
  assert.ok(Math.abs((f.w * 3024) / (f.h * 4032) - 0.8) < 1e-9);
  // Centered.
  assert.ok(Math.abs(f.x + f.w / 2 - 0.5) < 1e-9);
});

test("openAreaFrame fits 4:5 between the top buttons and the controls", () => {
  // iPhone 15: 393 x 852, top buttons end at 105, controls take the bottom 190.
  const f = openAreaFrame(0.8, { width: 393, height: 852 }, 105, 190, 16);
  assert.ok(f);
  assert.deepEqual(
    { width: f.width, height: f.height },
    { width: 361, height: 451 },
  );
  assert.equal(f.left, 16);
  // Centered in the open band (105 to 662), so it stays clear of both.
  assert.ok(
    Math.abs(f.top + f.height / 2 - (105 + (852 - 105 - 190) / 2)) < 1e-9,
  );
  assert.ok(f.top >= 105 + 16);
  assert.ok(f.top + f.height <= 852 - 190 - 16);
});

test("openAreaFrame shrinks by height on a small iPhone so it never sits under the controls", () => {
  // iPhone SE: 375 x 667, no notch: top buttons end at 70, controls take the bottom 160.
  const f = openAreaFrame(0.8, { width: 375, height: 667 }, 70, 160, 16);
  assert.ok(f);
  assert.ok(f.top >= 70 + 16);
  assert.ok(f.top + f.height <= 667 - 160 - 16 + 1e-9);
  assert.ok(Math.abs(f.width / f.height - 0.8) < 0.01);
  assert.ok(Math.abs(f.left + f.width / 2 - 375 / 2) < 1e-9);
});

test("openAreaFrame gives no frame when there is no room", () => {
  assert.equal(
    openAreaFrame(0.8, { width: 393, height: 200 }, 105, 190, 16),
    null,
  );
  assert.equal(
    openAreaFrame(0, { width: 393, height: 852 }, 105, 190, 16),
    null,
  );
});

test("openAreaFrame output maps back into the photo with cameraFrameFraction", () => {
  const area = { width: 393, height: 852 };
  const frame = openAreaFrame(0.8, area, 105, 190, 16);
  assert.ok(frame);
  const f = cameraFrameFraction({ width: 4032, height: 3024 }, area, frame);
  // Still a 4:5 piece of the photo, fully inside it.
  assert.ok(
    Math.abs((f.w * 3024) / (f.h * 4032) - frame.width / frame.height) < 1e-9,
  );
  assert.ok(
    f.x >= 0 && f.y >= 0 && f.x + f.w <= 1 + 1e-9 && f.y + f.h <= 1 + 1e-9,
  );
});

test("freeAspectFromDrag: the dragged edge follows the finger, the shape stays in the limits", () => {
  // 361 wide box at 1:1. Dragging the bottom edge up 40 makes it 80 shorter.
  const up = freeAspectFromDrag(361, 361, -40, "bottom");
  assert.ok(Math.abs(up.aspect - 361 / 281) < 1e-9);
  assert.equal(up.limit, null);
  // Dragging the top edge down by the same amount gives the same shape.
  const down = freeAspectFromDrag(361, 361, 40, "top");
  assert.ok(Math.abs(down.aspect - up.aspect) < 1e-9);
  // Pulling taller than 4:5 stops at 4:5.
  const tall = freeAspectFromDrag(361, 361, 400, "bottom");
  assert.equal(tall.aspect, 0.8);
  assert.equal(tall.limit, "tall");
  // Squashing wider than 1.91:1 stops at 1.91:1, even past zero height.
  const wide = freeAspectFromDrag(361, 361, -1000, "bottom");
  assert.equal(wide.aspect, 1.91);
  assert.equal(wide.limit, "wide");
});

test("aspectLabel names the presets and shows the rest as x : 1", () => {
  assert.equal(aspectLabel(0.8), "4:5");
  assert.equal(aspectLabel(1), "1:1");
  assert.equal(aspectLabel(16 / 9), "16:9");
  assert.equal(aspectLabel(1.91), "1.91:1");
  assert.equal(aspectLabel(1.1234), "1.12 : 1");
});
