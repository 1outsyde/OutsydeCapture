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
