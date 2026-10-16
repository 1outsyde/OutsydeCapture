import test from "node:test";
import assert from "node:assert/strict";
import { readableApiError } from "./apiError";

test("uses the backend's error sentence from a JSON body", () => {
  const e = new Error(
    'API Error 409: {"code":"DUPLICATE_ADDON","error":"This service already has that add-on"}',
  );
  assert.equal(readableApiError(e), "This service already has that add-on");
});

test("falls back to message when there is no error field", () => {
  assert.equal(
    readableApiError(new Error('API Error 400: {"message":"Invalid data"}')),
    "Invalid data",
  );
});

test("hides raw non-JSON API bodies behind the fallback", () => {
  assert.equal(
    readableApiError(
      new Error("API Error 502: <html>Bad gateway</html>"),
      "Try again.",
    ),
    "Try again.",
  );
});

test("keeps plain errors as they are", () => {
  assert.equal(
    readableApiError(new Error("Network request failed")),
    "Network request failed",
  );
});

test("uses the fallback for empty input", () => {
  assert.equal(readableApiError(undefined, "Fallback"), "Fallback");
});
