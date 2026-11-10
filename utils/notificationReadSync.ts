// Activity read status (step 1, 2026-11-10). Used by context/NotificationContext.tsx.
// Before this, read status lived only on the phone and the 30 second refresh worked from an old copy
// of the list, so rows marked read came back unread. Test: npx tsx utils/notificationReadSync.test.ts

export type ReadSyncRow = { id: string; read: boolean };

/** Rows made on this phone (local pushes, id "notif_<time>") never exist on the server. */
export function isServerNotificationId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && !id.startsWith("notif_");
}

/**
 * The server list merged into what the phone has: phone-only rows first, then the server rows in
 * server order. A row read on the phone stays read even if the server has not caught up yet.
 */
export function mergeServerNotifications<T extends ReadSyncRow>(current: T[], server: T[]): T[] {
  const readById = new Map(current.map((n) => [n.id, n.read]));
  const local = current.filter((n) => !isServerNotificationId(n.id));
  return [
    ...local,
    ...server.map((n) => (readById.get(n.id) === true && !n.read ? { ...n, read: true } : n)),
  ];
}

/** Marks one row read. changed = it was unread before, so the server should hear about it. */
export function markOneRead<T extends ReadSyncRow>(
  rows: T[],
  id: string,
): { rows: T[]; changed: boolean } {
  let changed = false;
  const next = rows.map((n) => {
    if (n.id !== id || n.read) return n;
    changed = true;
    return { ...n, read: true };
  });
  return { rows: changed ? next : rows, changed };
}

/** Marks every row read. serverChanged = at least one unread server row, so the server should hear about it. */
export function markEveryRead<T extends ReadSyncRow>(rows: T[]): { rows: T[]; serverChanged: boolean } {
  const serverChanged = rows.some((n) => !n.read && isServerNotificationId(n.id));
  return { rows: rows.map((n) => (n.read ? n : { ...n, read: true })), serverChanged };
}
