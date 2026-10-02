// Tiny module-level registry of "blocking" modals (notification priming, rating prompt,
// eligibility gate). The Stripe Connect prompt shows only when none are open, so it is always last.

const open = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function openModal(key: string): void {
  if (open.has(key)) return;
  open.add(key);
  notify();
}

export function closeModal(key: string): void {
  if (!open.delete(key)) return;
  notify();
}

export function isAnyOpen(): boolean {
  return open.size > 0;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Registers `key` while `visible` is true. Call from an effect; the returned cleanup closes it. */
export function registerWhile(key: string, visible: boolean): () => void {
  if (visible) openModal(key);
  return () => closeModal(key);
}
