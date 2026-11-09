/**
 * Quote screen layout rules (quote screen restyle, Nov 2026). Pure, tested in quoteView.test.ts.
 */

/** "What's included" shows this many lines before Read more. */
export const DETAILS_PREVIEW_LINES = 6;
/** Roughly 6 lines of body text on a phone. */
const PREVIEW_CHARS = 280;

/** True when the quote's details are long enough to fold behind Read more. */
export function detailsNeedReadMore(
  details: string | null | undefined,
): boolean {
  const text = (details ?? "").trim();
  if (!text) return false;
  const lines = text.split(/\r?\n/).length;
  return lines > DETAILS_PREVIEW_LINES || text.length > PREVIEW_CHARS;
}

/** Whether the details card shows at all: only when there's something to put in it. */
export function hasDetailsCard(q: {
  details?: string | null;
  extrasNote?: string | null;
}): boolean {
  return !!(q.details ?? "").trim() || !!(q.extrasNote ?? "").trim();
}
