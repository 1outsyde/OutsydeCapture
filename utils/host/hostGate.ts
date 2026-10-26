/**
 * Payout gate before hosting (Events canvas 35, Legend 2026-10-26): every host sets up Stripe first, even for free
 * RSVPs. Consumers use the personal payout account; businesses and photographers use the Stripe account they
 * already have. Status comes from GET /api/events/payouts/status?hostType= (403 = not that kind of host).
 */
import type { HostAs } from "./editorLogic";

export type GateStatus = "setup" | "finish" | "ready" | "none" | "unknown";
export type HostStatuses = Record<HostAs, GateStatus>;

/** 403 codes that mean "you are not this kind of host" (backend resolveOwnedHostProfile). */
const NOT_THIS_HOST = new Set(["NOT_A_BUSINESS_OWNER", "BUSINESS_NOT_APPROVED", "NOT_A_PHOTOGRAPHER"]);

/** One payouts/status answer (or its error) to a gate status. */
export function statusResult(res: { hasAccount?: unknown; ready?: unknown; [k: string]: unknown } | null, err?: unknown): GateStatus {
  if (res && typeof res.ready === "boolean") {
    if (res.ready) return "ready";
    return res.hasAccount ? "finish" : "setup";
  }
  const e = err as { status?: unknown; body?: { error?: { code?: unknown } } } | null | undefined;
  const code = e?.body?.error?.code;
  if (e?.status === 403 && typeof code === "string" && NOT_THIS_HOST.has(code)) return "none";
  return "unknown";
}

/** Who this person can host as. Personal is always there; business and photographer only when the backend knows them. */
export function hostChoicesFromStatus(s: HostStatuses): HostAs[] {
  const out: HostAs[] = ["user"];
  for (const h of ["business", "photographer"] as const) {
    if (s[h] !== "none" && s[h] !== "unknown") out.push(h);
  }
  return out;
}

/** The host type whose gate shows before the editor opens, or null. With two or more choices it waits for the pick. */
export function gateAtOpen(choices: HostAs[], s: HostStatuses): HostAs | null {
  if (choices.length !== 1) return null;
  const only = choices[0];
  return s[only] === "setup" || s[only] === "finish" ? only : null;
}

export interface GateCopy { title: string; body: string; step1: string; cta: string }

/** Copy for the gate (canvas 35). "setup" = no Stripe account yet, "finish" = an account that isn't finished. */
export function gateCopy(host: HostAs, state: "setup" | "finish"): GateCopy {
  if (state === "setup") {
    return {
      title: "Set up payouts to host events",
      body: "Every Outsyde host connects a bank through Stripe first, even for free RSVPs, so adding paid tickets later never stops your event.",
      step1: host === "user"
        ? "Tap Set up payouts. It opens the same Stripe setup businesses and photographers use."
        : host === "business" ? "Tap Set up payouts. It opens your business's Stripe setup." : "Tap Set up payouts. It opens your photographer Stripe setup.",
      cta: "Set up payouts",
    };
  }
  const whose = host === "business" ? "Your business's Stripe account" : host === "photographer" ? "Your photographer Stripe account" : "Your payout setup";
  return {
    title: "Finish your payout setup",
    body: `${whose} isn't finished yet. Finish it once and you can host free and paid events.`,
    step1: host === "business"
      ? "Tap Finish payout setup. It opens your business's Stripe setup."
      : host === "photographer" ? "Tap Finish payout setup. It opens your photographer Stripe setup." : "Tap Finish payout setup. It opens Stripe where you left off.",
    cta: "Finish payout setup",
  };
}

/**
 * The Stripe return deep link normally opens Points or a dashboard. While a host is setting up payouts from the
 * event editor it should stay on the editor instead, so the editor marks this before opening Stripe. In memory
 * only: if the app was closed meanwhile, the return goes where it always did.
 */
export const HOST_SETUP_TTL_MS = 60 * 60 * 1000;
let pendingSince: number | null = null;

export function markHostSetupPending(now: number = Date.now()): void {
  pendingSince = now;
}

/** True once when a host setup started in the last hour (then cleared). */
export function takeHostSetupPending(now: number = Date.now()): boolean {
  const since = pendingSince;
  pendingSince = null;
  return since !== null && now - since <= HOST_SETUP_TTL_MS;
}

/** The editor is closing: a later Stripe return goes where it always did. */
export function clearHostSetupPending(): void {
  pendingSince = null;
}

/** The navigator tells the open editor that the Stripe return came back (after any flag refresh it runs). */
const returnListeners = new Set<() => void>();
export function onHostSetupReturn(fn: () => void): () => void {
  returnListeners.add(fn);
  return () => { returnListeners.delete(fn); };
}
export function notifyHostSetupReturn(): void {
  for (const fn of [...returnListeners]) fn();
}
