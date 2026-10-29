import test from "node:test";
import assert from "node:assert/strict";
import { MAX_ZOOM, coverScale } from "./cropMath";
import {
  STORY_ASPECT,
  STORY_OUTPUT,
  clampStoryOffset,
  clampStoryZoom,
  scaleFrame,
  snapStoryZoom,
  storyCovers,
  storyMinZoom,
  storyPhotoFrame,
} from "./storyMath";

const box = { width: 360, height: 640 }; // 9:16 on screen
const landscape = { width: 4032, height: 3024 }; // 4:3 phone photo
const tall = { width: 1080, height: 1920 }; // already 9:16

test("story shape and output are 9:16 at 1080 x 1920", () => {
  assert.equal(STORY_ASPECT, 9 / 16);
  assert.deepEqual(STORY_OUTPUT, { width: 1080, height: 1920 });
  assert.equal(STORY_OUTPUT.width / STORY_OUTPUT.height, STORY_ASPECT);
});

test("min zoom lets a wide photo shrink until it fits the width", () => {
  const z = storyMinZoom(landscape, box);
  const shownW = landscape.width * coverScale(landscape, box) * z;
  assert.ok(Math.abs(shownW - box.width) < 1e-6);
  assert.ok(z < 1);
});

test("a photo already 9:16 cannot zoom out (min zoom is 1)", () => {
  assert.equal(storyMinZoom(tall, box), 1);
});

test("min zoom is 1 for empty sizes", () => {
  assert.equal(storyMinZoom({ width: 0, height: 10 }, box), 1);
  assert.equal(storyMinZoom(landscape, { width: 0, height: 0 }), 1);
});

test("zoom is held between the whole-photo zoom and MAX_ZOOM", () => {
  const min = storyMinZoom(landscape, box);
  assert.equal(clampStoryZoom(0.01, min), min);
  assert.equal(clampStoryZoom(99, min), MAX_ZOOM);
  assert.equal(clampStoryZoom(0.8, 0.5), 0.8);
  assert.equal(clampStoryZoom(Number.NaN, min), 1);
  // A bad min never lets the zoom go above cover as its floor.
  assert.equal(clampStoryZoom(0.5, 3), 1);
});

test("zoom near cover snaps to cover, others stay", () => {
  assert.equal(snapStoryZoom(0.97), 1);
  assert.equal(snapStoryZoom(1.03), 1);
  assert.equal(snapStoryZoom(0.9), 0.9);
  assert.equal(snapStoryZoom(1.5), 1.5);
});

test("covers only at zoom 1 or more", () => {
  assert.equal(storyCovers(1), true);
  assert.equal(storyCovers(2), true);
  assert.equal(storyCovers(0.99), false);
});

test("zoomed in: moves keep the photo covering the box", () => {
  const s = coverScale(landscape, box) * 2;
  const c = clampStoryOffset(9999, -9999, landscape, box, s);
  const shownW = landscape.width * s;
  const shownH = landscape.height * s;
  assert.ok(Math.abs(c.tx - (shownW - box.width) / 2) < 1e-6);
  assert.ok(Math.abs(c.ty + (shownH - box.height) / 2) < 1e-6);
});

test("zoomed out: the photo stays fully inside the box", () => {
  const z = storyMinZoom(landscape, box);
  const s = coverScale(landscape, box) * z;
  const shownH = landscape.height * s;
  const c = clampStoryOffset(50, 9999, landscape, box, s);
  // Width fits exactly, so no sideways room.
  assert.ok(Math.abs(c.tx) < 1e-6);
  // Up and down: only as far as the box edge.
  assert.ok(Math.abs(c.ty - (box.height - shownH) / 2) < 1e-6);
  const f = storyPhotoFrame(landscape, box, z, c.tx, c.ty);
  assert.ok(f.top >= -1e-6 && f.top + f.height <= box.height + 1e-6);
  assert.ok(f.left >= -1e-6 && f.left + f.width <= box.width + 1e-6);
});

test("photo frame is centered at zoom 1 with no move, and covers the box", () => {
  const f = storyPhotoFrame(landscape, box, 1, 0, 0);
  assert.ok(Math.abs(f.left + f.width / 2 - box.width / 2) < 1e-6);
  assert.ok(Math.abs(f.top + f.height / 2 - box.height / 2) < 1e-6);
  assert.ok(f.left <= 0 && f.top <= 0);
  assert.ok(f.left + f.width >= box.width && f.top + f.height >= box.height);
});

test("frame scales from the screen box to 1080 x 1920", () => {
  const f = storyPhotoFrame(landscape, box, storyMinZoom(landscape, box), 0, 0);
  const out = scaleFrame(f, box, STORY_OUTPUT);
  assert.ok(Math.abs(out.width - 1080) < 1e-6); // fits the width exactly
  assert.ok(Math.abs(out.top + out.height / 2 - 960) < 1e-6); // centered
});
