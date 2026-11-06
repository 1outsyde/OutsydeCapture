/**
 * Change email screen logic (backend #426 + #428). Pure: no React, no network, so it runs under tsx tests.
 * The backend's own messages are shown as they come (they're written for customers, no dashes); these
 * fallbacks cover a network failure or an older backend.
 */

export const CODE_LENGTH = 6;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Same rule the backend uses in spirit: something@something.something, no spaces. */
export function isValidEmail(email: string): boolean {
  const e = email.trim();
  return (
    e.length >= 3 && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  );
}

/** Digits only, at most 6 (pasted codes with spaces or dashes still work). */
export function cleanCode(input: string): string {
  return input.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

export type EmailFormCheck = { ok: true } | { ok: false; message: string };

export function checkEmailForm(p: {
  newEmail: string;
  currentEmail: string | null | undefined;
  password: string;
  passwordRequired: boolean;
}): EmailFormCheck {
  if (!isValidEmail(p.newEmail))
    return { ok: false, message: "Enter a valid email address." };
  if (
    p.currentEmail &&
    normalizeEmail(p.newEmail) === normalizeEmail(p.currentEmail)
  ) {
    return { ok: false, message: "That's already your email." };
  }
  if (p.passwordRequired && !p.password)
    return { ok: false, message: "Enter your password to change your email." };
  return { ok: true };
}

const FALLBACKS: Record<string, string> = {
  INVALID_EMAIL: "Enter a valid email address.",
  SAME_EMAIL: "That's already your email.",
  EMAIL_NOT_ALLOWED: "This email can't be used.",
  PASSWORD_REQUIRED: "Enter your password to change your email.",
  WRONG_PASSWORD: "That password isn't right.",
  EMAIL_TAKEN: "This email is already used by another Outsyde account.",
  TOO_MANY_REQUESTS: "Too many tries. Please wait an hour and try again.",
  EMAIL_FAILED:
    "We couldn't send the code to that address. Check it and try again.",
  REQUEST_BUSY:
    "Your last request is still being set up. Try again in a moment.",
  INVALID_CODE: "Enter the 6 digit code.",
  WRONG_CODE: "That code isn't right.",
  CODE_EXPIRED: "This code expired. Ask for a new one.",
  TOO_MANY_TRIES: "Too many wrong codes. Ask for a new one.",
  NO_PENDING: "There's no email change waiting. Start again.",
  ADMIN_ACCOUNT: "Admin accounts can't change their email here.",
  ACCOUNT_UNAVAILABLE: "This account can't change its email.",
};

export const GENERIC_ERROR = "Something went wrong. Please try again.";

export interface ReadError {
  code: string | null;
  message: string;
  triesLeft: number | null;
}

/** Reads an ApiError thrown by services/api ({ message, status, body }). */
export function readEmailChangeError(err: unknown): ReadError {
  const body = (err as any)?.body;
  const e = body?.error;
  const code: string | null =
    e && typeof e === "object" && typeof e.code === "string" ? e.code : null;
  const backendMessage: string | null =
    e && typeof e === "object" && typeof e.message === "string" && e.message
      ? e.message
      : null;
  const triesLeft = typeof body?.triesLeft === "number" ? body.triesLeft : null;
  const base = backendMessage ?? (code && FALLBACKS[code]) ?? GENERIC_ERROR;
  const message =
    code === "WRONG_CODE" && triesLeft != null
      ? `${base} ${triesLeft === 1 ? "1 try left." : `${triesLeft} tries left.`}`
      : base;
  return { code, message, triesLeft };
}

/** Codes after which the code step is over and the person starts again from the email step. */
export function endsCodeStep(code: string | null): boolean {
  return (
    code === "CODE_EXPIRED" ||
    code === "TOO_MANY_TRIES" ||
    code === "NO_PENDING" ||
    code === "EMAIL_TAKEN"
  );
}

/** "Expires in 12 minutes" (whole minutes, at least 1), or null once past. */
export function expiryLine(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const mins = Math.max(1, Math.ceil(ms / 60000));
  return `The code expires in ${mins} ${mins === 1 ? "minute" : "minutes"}.`;
}
