// Incoming links are logged for debugging (AuthContext). Stripe's return link
// (outsyde://stripe-redirect) carries payment client secrets in its query, so those links log without it.
export function logSafeUrl(
  url: string | null | undefined,
): string | null | undefined {
  if (!url) return url;
  if (url.includes("stripe-redirect") || url.includes("client_secret")) {
    const q = url.indexOf("?");
    return q === -1 ? url : `${url.slice(0, q)}?[redacted]`;
  }
  return url;
}
