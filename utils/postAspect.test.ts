import test from "node:test";
import assert from "node:assert/strict";
import { postAspect, postMediaHeight, DEFAULT_POST_ASPECT } from "./postAspect";

test("no size, or a broken size, gives 4:5", () => {
  assert.equal(postAspect(undefined), DEFAULT_POST_ASPECT);
  assert.equal(postAspect({}), 0.8);
  assert.equal(
    postAspect({ aspectRatio: 0, mediaWidth: null, mediaHeight: 0 }),
    0.8,
  );
  assert.equal(
    postAspect({ aspectRatio: Number.NaN, media: { width: 100 } }),
    0.8,
  );
  assert.equal(postAspect({ mediaWidth: -5, mediaHeight: 10 }), 0.8);
});

test("reads the post row: aspectRatio, then mediaWidth / mediaHeight", () => {
  assert.equal(postAspect({ aspectRatio: 1 }), 1);
  assert.equal(
    postAspect({ mediaWidth: 1920, mediaHeight: 1080 }),
    1920 / 1080,
  );
  assert.equal(
    postAspect({ aspectRatio: 1, mediaWidth: 1920, mediaHeight: 1080 }),
    1,
  );
});

test("reads the media object (/api/users/:id/posts)", () => {
  assert.equal(postAspect({ media: { width: 1080, height: 1080 } }), 1);
  assert.equal(
    postAspect({ media: { aspectRatio: 16 / 9, width: null, height: null } }),
    16 / 9,
  );
});

test("multi-photo posts use photo 1", () => {
  const post = {
    aspectRatio: 0.8,
    mediaItems: [
      { width: 1080, height: 1080, aspectRatio: 1 },
      { width: 1080, height: 1350, aspectRatio: 0.8 },
    ],
  };
  assert.equal(postAspect(post), 1);
  // Photo 1 without a size falls back to the post row.
  assert.equal(postAspect({ aspectRatio: 1.5, mediaItems: [{}, {}] }), 1.5);
  // One item is not a multi-photo post.
  assert.equal(
    postAspect({ aspectRatio: 1, mediaItems: [{ aspectRatio: 1.91 }] }),
    1,
  );
});

test("held between 4:5 and 1.91:1", () => {
  assert.equal(postAspect({ aspectRatio: 9 / 16 }), 0.8); // tall video
  assert.equal(postAspect({ mediaWidth: 3000, mediaHeight: 1000 }), 1.91);
});

test("postMediaHeight is a whole number from the width", () => {
  assert.equal(postMediaHeight(390, 0.8), 488);
  assert.equal(postMediaHeight(390, 1), 390);
  assert.equal(postMediaHeight(390, 16 / 9), 219);
  assert.equal(postMediaHeight(390, 0.5), 488); // held at 4:5
});
