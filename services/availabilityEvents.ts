type Listener = () => void;

const listeners: Set<Listener> = new Set();

export const availabilityEvents = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  emit(): void {
    listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.warn("[availabilityEvents] Listener error:", e);
      }
    });
  },
};
