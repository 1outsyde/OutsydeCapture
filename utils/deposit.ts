export const MIN_DEPOSIT_CENTS = 700;

// Strict dollar parsing for the deposit input: "$30", "30,50" and "30.5" are
// accepted; partial numbers like "12abc" or "3.555" are rejected.
export const parseDepositInput = (
  raw: string,
): { cents: number } | { error: string } => {
  const s = raw.trim().replace(/^\$/, "").trim().replace(",", ".");
  if (s === "") return { error: "Enter a deposit amount." };
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    return { error: "Enter a valid amount, like 30.00." };
  }
  return { cents: Math.round(parseFloat(s) * 100) };
};
