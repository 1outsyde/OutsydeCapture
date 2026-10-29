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
