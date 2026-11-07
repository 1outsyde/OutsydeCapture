// Run something only after a full screen pop-up has finished closing.
// On iOS a navigation or a second pop-up started while the first is still
// on screen lands underneath it, so the action waits for Modal's onDismiss.
// Android has no onDismiss, so the action runs right after the close call.
export interface AfterClose {
  queue(fn: () => void): void;
  onDismiss(): void;
  runIfImmediate(): void;
}

export function createAfterClose(platform: string): AfterClose {
  let pending: (() => void) | null = null;
  const run = () => {
    const fn = pending;
    pending = null;
    fn?.();
  };
  return {
    queue(fn) {
      pending = fn;
    },
    onDismiss() {
      if (platform === "ios") run();
    },
    runIfImmediate() {
      if (platform !== "ios") run();
    },
  };
}
