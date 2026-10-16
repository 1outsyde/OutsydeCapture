// Turns an api/client.ts error ("API Error 409: {"error":"..."}") into the
// plain sentence the backend sent, for showing to vendors.
export function readableApiError(
  e: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const match = raw.match(/^API Error \d+: ([\s\S]*)$/);
  if (match) {
    try {
      const body = JSON.parse(match[1]);
      const msg = body?.error ?? body?.message;
      if (typeof msg === "string" && msg.trim()) return msg;
    } catch {
      // body was not JSON
    }
    return fallback;
  }
  return raw || fallback;
}
