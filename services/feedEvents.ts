type FeedType = "pulse" | "pro";
type Listener = (feedType: FeedType) => void;

const listeners: Set<Listener> = new Set();

export const feedEvents = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  emitRefresh(feedType: FeedType): void {
    console.log(`[feedEvents] Emitting refresh for ${feedType} feed`);
    listeners.forEach((listener) => {
      try {
        listener(feedType);
      } catch (e) {
        console.warn("[feedEvents] Listener error:", e);
      }
    });
  },
};
