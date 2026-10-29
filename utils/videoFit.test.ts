import test from "node:test";
import assert from "node:assert/strict";
import {
  apiVideoFit,
  defaultVideoFit,
  normalizeVideoFit,
  videoBlurUri,
} from "./videoFit";

test("only 'fit' is fit; everything else (old posts) is fill", () => {
  assert.equal(normalizeVideoFit("fit"), "fit");
  assert.equal(normalizeVideoFit("fill"), "fill");
  for (const v of [null, undefined, "", "FIT", "contain", 1])
    assert.equal(normalizeVideoFit(v), "fill");
});

test("apiVideoFit keeps only the two values the backend accepts", () => {
  assert.equal(apiVideoFit("fit"), "fit");
  assert.equal(apiVideoFit("fill"), "fill");
  assert.equal(apiVideoFit(null), undefined);
  assert.equal(apiVideoFit("cover"), undefined);
});

test("default: fill for tall or unknown, fit for wide or square", () => {
  assert.equal(defaultVideoFit(1080, 1920), "fill");
  assert.equal(defaultVideoFit(1080, 1350), "fill"); // 4:5
  assert.equal(defaultVideoFit(1080, 1080), "fit");
  assert.equal(defaultVideoFit(1920, 1080), "fit");
  assert.equal(defaultVideoFit(undefined, undefined), "fill"); // camera recording
  assert.equal(defaultVideoFit(0, 1920), "fill");
});

test("blur picture: thumbnail, else the Mux thumbnail from the stream URL", () => {
  assert.equal(
    videoBlurUri("https://image.mux.com/abc/thumbnail.jpg", null),
    "https://image.mux.com/abc/thumbnail.jpg",
  );
  assert.equal(
    videoBlurUri(null, "https://stream.mux.com/Abc123.m3u8"),
    "https://image.mux.com/Abc123/thumbnail.jpg",
  );
  // A stream URL in the thumbnail field is not a picture.
  assert.equal(
    videoBlurUri(
      "https://stream.mux.com/Abc123.m3u8",
      "https://stream.mux.com/Abc123.m3u8",
    ),
    "https://image.mux.com/Abc123/thumbnail.jpg",
  );
  // An upload id (still processing) or a local file has no blur.
  assert.equal(videoBlurUri("", "upload_123"), null);
  assert.equal(videoBlurUri(null, "file:///video.mov"), null);
});
