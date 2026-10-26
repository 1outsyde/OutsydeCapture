/**
 * Host side money for paid tickets. Event Host Agreement 6.2: Outsyde keeps 2% of the ticket price,
 * rounded to the nearest cent. Same math as the backend's calculateTicketFees (server/fees.ts):
 * unitHostNetCents = price - Math.round(price * 0.02).
 */

export const HOST_FEE_RATE = 0.02;

/** What the host earns per ticket, in cents. Free (or invalid) prices earn 0. */
export function hostEarningsCents(priceCents: number): number {
  if (!Number.isInteger(priceCents) || priceCents <= 0) return 0;
  return priceCents - Math.round(priceCents * HOST_FEE_RATE);
}
