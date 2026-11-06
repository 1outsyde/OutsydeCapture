/**
 * Quotes step 6b (app): goutsyde.com/q/<code> links open the quote in the app. Pure: no React Native, no network.
 * Tested in utils/quoteLinks.test.ts. Backend: GET /api/quotes/link/:code (outsyde-backend quoteRoutes.ts, step 5a):
 * signed out a preview; the customer, the business (owner or sending staff) or admin the quote id; anyone else
 * 403 OTHER_ACCOUNT; a bad code 404. Legend 2026-11-06 (App Store build calls 2 and 3, as recommended).
 * Copy: commas and periods only, never the fee rate.
 */

const QUOTE_LINK_HOSTS = ["goutsyde.com", "www.goutsyde.com"];
/** Link codes are randomBytes(12) base64url (16 characters); allow a little room, never a path or a query. */
const CODE_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** The quote code in a goutsyde.com/q/<code> link, or null for anything else. */
export function parseQuoteLink(url: string | null | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== "https:" ||
    !QUOTE_LINK_HOSTS.includes(parsed.hostname.toLowerCase())
  )
    return null;
  const m = /^\/q\/([^/]+)\/?$/.exec(parsed.pathname);
  if (!m || !CODE_RE.test(m[1])) return null;
  return m[1];
}

/** The same quote on goutsyde.com, for View on the web (opened in the in-app browser, never back into the app). */
export const quoteWebUrl = (code: string) =>
  `https://goutsyde.com/q/${encodeURIComponent(code)}`;

export type QuoteLinkPreview = {
  title?: string | null;
  businessName?: string | null;
  [k: string]: unknown;
};

export type QuoteLinkOutcome =
  | { kind: "open"; quoteId: string }
  | { kind: "preview"; preview: QuoteLinkPreview }
  | { kind: "other-account" }
  | { kind: "not-found" }
  | { kind: "error" };

/** What the link screen does with the backend's answer. */
export function quoteLinkOutcome(r: {
  status: number;
  body: any;
}): QuoteLinkOutcome {
  const b = r.body;
  if (r.status === 200 && b) {
    if (
      (b.access === "customer" ||
        b.access === "vendor" ||
        b.access === "admin") &&
      typeof b.quoteId === "string" &&
      b.quoteId
    ) {
      return { kind: "open", quoteId: b.quoteId };
    }
    if (b.access === "preview" && b.preview && typeof b.preview === "object")
      return { kind: "preview", preview: b.preview };
    return { kind: "error" };
  }
  if (r.status === 403 && b?.code === "OTHER_ACCOUNT")
    return { kind: "other-account" };
  if (r.status === 404) return { kind: "not-found" };
  return { kind: "error" };
}

export const QUOTE_LINK_COPY = {
  signIn: "Sign in to see your quote, pay it and message the business.",
  otherAccount:
    "This quote was sent to another Outsyde account. Sign in with the email it was sent to, or view it on the web.",
  notFound: "This quote link isn't valid. Ask the business to send it again.",
  error:
    "We couldn't open this quote right now. Check your connection and try again.",
};
