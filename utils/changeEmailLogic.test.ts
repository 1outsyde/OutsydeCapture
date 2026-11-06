/** Change email screen logic. Run with: npx tsx utils/changeEmailLogic.test.ts */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkEmailForm,
  cleanCode,
  endsCodeStep,
  expiryLine,
  isValidEmail,
  normalizeEmail,
  readEmailChangeError,
  GENERIC_ERROR,
} from "./changeEmailLogic";

let n = 0;
const t = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok ${n} ${name}`);
};

t("email shape", () => {
  assert.ok(isValidEmail(" Benny@Yahoo.com "));
  for (const bad of ["", "a", "a@b", "a b@c.co", "@c.co", "a@.co x"])
    assert.equal(isValidEmail(bad), false, bad);
  assert.equal(normalizeEmail("  New@Mail.COM "), "new@mail.com");
});

t("code input keeps digits only, at most 6", () => {
  assert.equal(cleanCode("12 34-56"), "123456");
  assert.equal(cleanCode("1234567"), "123456");
  assert.equal(cleanCode("ab"), "");
});

t("form checks before sending", () => {
  assert.deepEqual(
    checkEmailForm({
      newEmail: "x",
      currentEmail: "a@b.co",
      password: "",
      passwordRequired: false,
    }),
    { ok: false, message: "Enter a valid email address." },
  );
  assert.deepEqual(
    checkEmailForm({
      newEmail: " A@B.co ",
      currentEmail: "a@b.co",
      password: "p",
      passwordRequired: true,
    }),
    { ok: false, message: "That's already your email." },
  );
  assert.deepEqual(
    checkEmailForm({
      newEmail: "n@b.co",
      currentEmail: "a@b.co",
      password: "",
      passwordRequired: true,
    }),
    { ok: false, message: "Enter your password to change your email." },
  );
  assert.deepEqual(
    checkEmailForm({
      newEmail: "n@b.co",
      currentEmail: "a@b.co",
      password: "",
      passwordRequired: false,
    }),
    { ok: true },
  );
  assert.deepEqual(
    checkEmailForm({
      newEmail: "n@b.co",
      currentEmail: null,
      password: "p",
      passwordRequired: true,
    }),
    { ok: true },
  );
});

t("backend message wins; fallback by code; generic last", () => {
  const be = readEmailChangeError({
    status: 409,
    body: {
      success: false,
      error: { code: "EMAIL_TAKEN", message: "Backend words." },
    },
  });
  assert.deepEqual(be, {
    code: "EMAIL_TAKEN",
    message: "Backend words.",
    triesLeft: null,
  });
  assert.equal(
    readEmailChangeError({ body: { error: { code: "CODE_EXPIRED" } } }).message,
    "This code expired. Ask for a new one.",
  );
  assert.equal(
    readEmailChangeError({ message: "Network request failed" }).message,
    GENERIC_ERROR,
  );
  assert.equal(readEmailChangeError(undefined).code, null);
  // An older shape: error as a plain string is not trusted as a code.
  assert.equal(
    readEmailChangeError({ body: { error: "Not authenticated" } }).code,
    null,
  );
});

t("wrong code adds tries left", () => {
  const four = readEmailChangeError({
    body: {
      error: { code: "WRONG_CODE", message: "That code isn't right." },
      triesLeft: 4,
    },
  });
  assert.equal(four.message, "That code isn't right. 4 tries left.");
  assert.equal(
    readEmailChangeError({
      body: { error: { code: "WRONG_CODE" }, triesLeft: 1 },
    }).message,
    "That code isn't right. 1 try left.",
  );
});

t("which errors end the code step", () => {
  for (const c of [
    "CODE_EXPIRED",
    "TOO_MANY_TRIES",
    "NO_PENDING",
    "EMAIL_TAKEN",
  ])
    assert.ok(endsCodeStep(c), c);
  for (const c of ["WRONG_CODE", "INVALID_CODE", null])
    assert.equal(endsCodeStep(c), false, String(c));
});

t("expiry line", () => {
  const now = new Date("2026-11-06T12:00:00Z");
  assert.equal(
    expiryLine("2026-11-06T12:15:00Z", now),
    "The code expires in 15 minutes.",
  );
  assert.equal(
    expiryLine("2026-11-06T12:00:20Z", now),
    "The code expires in 1 minute.",
  );
  assert.equal(expiryLine("2026-11-06T11:59:00Z", now), null);
  assert.equal(expiryLine(null, now), null);
});

t("no dashes in any copy", () => {
  const src = readFileSync(join(__dirname, "changeEmailLogic.ts"), "utf8");
  const strings = src.match(/"[^"\n]*"|`[^`\n]*`/g) ?? [];
  for (const s of strings) assert.ok(!/[–—]|\s-\s/.test(s), s);
});

console.log(`\n${n} passed`);
