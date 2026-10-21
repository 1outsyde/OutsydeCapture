// Shared state for the hidden plan offer: the Main popup host, the BusinessDashboard banner and the
// plan_offer push hook all read this, so a Not now in one place is seen by the others.
// Per launch on purpose (module memory, never persisted): the popup shows once per launch, the banner's
// X hides it until the next launch (Reminder artboard: "Hide until next time you open the app").

import type { PlanOffer } from "./planOffer";

let userId: string | null = null;
let offer: PlanOffer | null = null;
let checking = false;
let openRequested = false;
const popupSeen = new Set<string>();
const bannerHidden = new Set<string>();
/** Offers claimed in this launch: a late answer that still lists one as pending is ignored. */
const claimedIds = new Set<string>();
let claimed: Claimed | null = null;
let checkRequest = 0;
let recheckPending = false;

/** The free plan was claimed: the done screen lives here so a remount (dashboard reload) keeps it. */
export interface Claimed {
  offer: PlanOffer;
  /** Which popup shows the done screen. */
  where: "main" | "dashboard";
  payoutsReady: boolean;
}
const listeners = new Set<() => void>();
let version = 0;

function notify() {
  version++;
  listeners.forEach((l) => l());
}

/** Bumped on every change (lets usePlanOffer cache its snapshot). */
export function getVersion(): number {
  return version;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Signed in as someone else (or signed out): forget everything about the last account. */
export function resetForUser(id: string | null): void {
  if (id === userId && id !== null) return;
  userId = id;
  offer = null;
  checking = false;
  openRequested = false;
  popupSeen.clear();
  bannerHidden.clear();
  claimedIds.clear();
  claimed = null;
  recheckPending = false;
  notify();
}

export function getOffer(): PlanOffer | null {
  return offer;
}

export function isChecking(): boolean {
  return checking;
}

export function setChecking(value: boolean): void {
  if (checking === value) return;
  checking = value;
  notify();
}

/** Result of GET /api/vendor/plan-offer (also ends the check). */
export function setOffer(next: PlanOffer | null): void {
  offer = next && claimedIds.has(next.id) ? null : next;
  checking = false;
  notify();
}

/** Accepted, withdrawn or no longer theirs. */
export function clearOffer(): void {
  setOffer(null);
}

export function wantsPopup(): boolean {
  if (!offer) return false;
  return openRequested || !popupSeen.has(offer.id);
}

export function showBanner(): boolean {
  return !!offer && !bannerHidden.has(offer.id);
}

/** Not now or X on the popup: the banner keeps it one tap away. */
export function dismissPopup(): void {
  if (offer) popupSeen.add(offer.id);
  openRequested = false;
  notify();
}

export function hideBanner(): void {
  if (offer) bannerHidden.add(offer.id);
  notify();
}

/** A push, Activity or banner tap: show the popup again, and check now (the offer may be brand new). */
export function requestOpen(): void {
  openRequested = true;
  checkRequest++;
  notify();
}

/** Bumped when something asks for a fresh check; useCheckPlanOffer answers with a forced check. */
export function getCheckRequest(): number {
  return checkRequest;
}

/** Sent to goutsyde.com to confirm: check again the moment the app is back (skips the throttle). */
export function recheckOnReturn(): void {
  recheckPending = true;
}

export function consumeRecheckOnReturn(): boolean {
  const was = recheckPending;
  recheckPending = false;
  return was;
}

export function markClaimed(
  o: PlanOffer,
  where: Claimed["where"],
  payoutsReady: boolean,
): void {
  claimedIds.add(o.id);
  claimed = { offer: o, where, payoutsReady };
  offer = null;
  openRequested = false;
  checking = false;
  notify();
}

export function getClaimed(): Claimed | null {
  return claimed;
}

/** The vendor closed the done screen. */
export function finishClaimed(): void {
  claimed = null;
  notify();
}
