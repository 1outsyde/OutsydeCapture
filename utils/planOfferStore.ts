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
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
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
  offer = next;
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

/** A push, Activity or banner tap: show the popup again (once the offer has loaded). */
export function requestOpen(): void {
  openRequested = true;
  notify();
}
