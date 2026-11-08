// The Outsyde server address (payment methods Step 5, Legend 2026-11-08). App Store and preview builds set
// nothing and get production. The stripe-test build profile sets EXPO_PUBLIC_API_URL to the test backend.
// Only a plain https origin is accepted; anything else falls back to production. The address is written here
// only (utils/apiBaseUrl.test.ts checks), so a build can never talk to two servers at once.
export const PRODUCTION_API_URL = "https://outsyde-backend.onrender.com";

export function resolveApiBaseUrl(raw: string | undefined | null): string {
  const v = (raw ?? "").trim().replace(/\/+$/, "");
  return /^https:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(v) ? v : PRODUCTION_API_URL;
}
