import { api } from "@/services/api";

// Sends the device time zone to POST /api/me/time-zone once per app launch per
// role. The backend only fills it in when the profile has none yet, so this is
// safe to call on every launch. Never blocks the UI and never throws.
const sentForRole: Record<string, boolean> = {};

export function syncMyTimeZoneOnce(
  role: "business" | "photographer",
  getToken: () => Promise<string | null | undefined>,
): void {
  if (sentForRole[role]) return;
  sentForRole[role] = true;

  void (async () => {
    try {
      let timeZone = "";
      try {
        timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      } catch {
        timeZone = "";
      }
      if (!timeZone) return;
      const token = await getToken();
      if (!token) {
        // No session yet, so allow a later attempt in this launch.
        sentForRole[role] = false;
        return;
      }
      await api.setMyTimeZone(token, timeZone);
    } catch (err) {
      console.warn("[TimeZone] Could not save time zone:", err);
    }
  })();
}
