// Account setup helpers (pure, no React) — shared by the login, claim and finish-setup flows.
// Backend: /api/account-setup/* (outsyde-backend #289). Website equivalents: goutsyde.com/claim, /finish.

import type { AccountSetupStatus } from "@/services/api";

export const SETUP_LINK_HOSTS = ["goutsyde.com", "www.goutsyde.com"];

/** What the login screen needs when the backend answers ACCOUNT_NEEDS_SETUP. */
export interface NeedsSetup {
  /** Only set when the person typed an email (a username login never reveals the email). */
  email?: string;
  hasUsername?: boolean;
}

/**
 * Reads a failed mobile login. The backend answers 401 { error: { code: "ACCOUNT_NEEDS_SETUP",
 * email?, hasUsername } } for an account that exists but has no password yet, and has already
 * emailed a 6-digit code. Returns null for every other failure.
 */
export function needsSetupFromLoginError(
  error: unknown,
  loginType: "email" | "username",
  identifier: string,
): NeedsSetup | null {
  const body = (error as { body?: { error?: unknown } } | null)?.body;
  const err = body?.error as
    | { code?: unknown; email?: unknown; hasUsername?: unknown }
    | undefined;
  if (!err || typeof err !== "object" || err.code !== "ACCOUNT_NEEDS_SETUP")
    return null;
  const typed =
    loginType === "email" ? identifier.trim().toLowerCase() : undefined;
  const fromServer =
    typeof err.email === "string" && err.email
      ? err.email.toLowerCase()
      : undefined;
  return {
    email: fromServer ?? typed,
    hasUsername:
      typeof err.hasUsername === "boolean" ? err.hasUsername : undefined,
  };
}

/** The `code` inside an ApiError body, e.g. USERNAME_REQUIRED. */
export function apiErrorCode(error: unknown): string | null {
  const err = (error as { body?: { error?: { code?: unknown } } } | null)?.body
    ?.error;
  return err && typeof err.code === "string" ? err.code : null;
}

/** A readable message from an ApiError (the backend's error.message when present). */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const e = error as {
    message?: unknown;
    body?: { error?: { message?: unknown } | string };
  } | null;
  const nested = e?.body?.error;
  if (
    nested &&
    typeof nested === "object" &&
    typeof nested.message === "string" &&
    nested.message
  )
    return nested.message;
  if (typeof nested === "string" && nested) return nested;
  if (
    typeof e?.message === "string" &&
    e.message &&
    !e.message.startsWith("HTTP ")
  )
    return e.message;
  return fallback;
}

export type AccountSetupLink =
  | { kind: "claim"; email?: string; token?: string }
  | { kind: "finish"; stripe?: string };

/**
 * Recognises goutsyde.com/claim and /finish links (reminder emails, universal links).
 * Anything else — other pages, other hosts, the outsyde:// scheme — returns null.
 */
export function parseAccountSetupLink(url: string): AccountSetupLink | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== "https:" ||
    !SETUP_LINK_HOSTS.includes(parsed.hostname.toLowerCase())
  )
    return null;
  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  if (path === "/claim") {
    const email =
      parsed.searchParams.get("email")?.trim().toLowerCase() || undefined;
    const token = parsed.searchParams.get("token") || undefined;
    return { kind: "claim", email, token };
  }
  if (path === "/finish") {
    return {
      kind: "finish",
      stripe: parsed.searchParams.get("stripe") || undefined,
    };
  }
  return null;
}

/** Steps the person can act on now (approval is the team's job, never theirs). */
export function actionableSteps(status: AccountSetupStatus | null | undefined) {
  if (!status || status.complete) return [];
  return status.steps.filter((s) => s.state === "todo" && s.key !== "approval");
}

/**
 * Whether to open the full finish-setup screen right after sign-in. Staff are excluded: the app
 * already sends staff without payouts to StaffOnboarding (MainTabNavigator).
 */
export function shouldOpenFinishSetup(
  status: AccountSetupStatus | null | undefined,
  role: string | undefined,
): boolean {
  if (role === "staff") return false;
  return actionableSteps(status).length > 0;
}

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** Lowercase, no leading @, no spaces — the same shape the backend's validateUsername accepts. */
export function cleanUsernameInput(raw: string): string {
  return raw.toLowerCase().replace(/\s/g, "").replace(/^@+/, "");
}
