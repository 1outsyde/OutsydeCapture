/**
 * Booking settings defaults (Manage Business step 3, backend #374): the business cancellation policy
 * and the default deposit, plus turning GET /api/vendor/setup-status into the hub's checklist.
 *
 *   npx tsx utils/businessDefaults.test.ts
 *
 * The policy checks are the same as the backend's parseCancellationPolicy, so a problem is shown in the
 * form instead of coming back from the save.
 */
import type {
  BusinessCancellationPolicy,
  BusinessSetupStatus,
  RefundWindow,
} from "@/services/api";
import type { SetupStep, SetupTarget } from "@/utils/setupChecklist";

export const REFUND_WINDOWS: { value: RefundWindow; label: string }[] = [
  { value: "1_week", label: "1 week" },
  { value: "48_hours", label: "48 hours" },
  { value: "24_hours", label: "24 hours" },
  { value: "1_hour", label: "1 hour" },
  { value: "never", label: "Never" },
];
const WINDOW_VALUES = REFUND_WINDOWS.map((w) => w.value);
const isWindow = (v: unknown): v is RefundWindow =>
  typeof v === "string" && (WINDOW_VALUES as string[]).includes(v);

export const MIN_DEPOSIT_CENTS = 700;

/** What the Booking settings form edits. Money and percentages are what the business typed. */
export interface PolicyDraft {
  fullRefundWindow: RefundWindow;
  hasPartialRefund: boolean;
  partialRefundWindow: RefundWindow;
  partialPercentInput: string;
  hasCancellationFee: boolean;
  cancellationFeeType: "flat" | "percentage";
  feeInput: string;
}

interface BusinessPolicyFields {
  fullRefundWindow?: string | null;
  hasPartialRefund?: boolean | null;
  partialRefundWindow?: string | null;
  partialRefundPercentage?: number | null;
  hasCancellationFee?: boolean | null;
  cancellationFeeType?: string | null;
  cancellationFeeAmount?: number | null;
}

export function policyDraftFrom(
  b: BusinessPolicyFields | null | undefined,
): PolicyDraft {
  const feeType =
    b?.cancellationFeeType === "percentage" ? "percentage" : "flat";
  const fee = b?.cancellationFeeAmount;
  return {
    fullRefundWindow: isWindow(b?.fullRefundWindow)
      ? (b!.fullRefundWindow as RefundWindow)
      : "never",
    hasPartialRefund: b?.hasPartialRefund === true,
    partialRefundWindow: isWindow(b?.partialRefundWindow)
      ? (b!.partialRefundWindow as RefundWindow)
      : "24_hours",
    partialPercentInput:
      b?.partialRefundPercentage != null
        ? String(b.partialRefundPercentage)
        : "",
    hasCancellationFee: b?.hasCancellationFee === true,
    cancellationFeeType: feeType,
    feeInput:
      fee != null
        ? feeType === "flat"
          ? (fee / 100).toFixed(2)
          : String(fee)
        : "",
  };
}

/** Draft → the PUT body, or the first problem to show. */
export function policyFromDraft(
  d: PolicyDraft,
): { policy: BusinessCancellationPolicy } | { error: string } {
  let partialRefundPercentage: number | null = null;
  if (d.hasPartialRefund) {
    const n = Number(d.partialPercentInput.trim());
    if (
      !d.partialPercentInput.trim() ||
      !Number.isInteger(n) ||
      n < 1 ||
      n > 100
    ) {
      return { error: "Enter the percentage customers get back, 1 to 100" };
    }
    partialRefundPercentage = n;
  }
  let cancellationFeeAmount: number | null = null;
  if (d.hasCancellationFee) {
    const raw = d.feeInput.trim().replace(/^\$/, "");
    if (d.cancellationFeeType === "flat") {
      if (
        !/^\d+(\.\d{0,2})?$/.test(raw) ||
        Math.round(parseFloat(raw) * 100) < 1
      ) {
        return {
          error: "Enter the cancellation fee in dollars, like 20 or 20.50",
        };
      }
      cancellationFeeAmount = Math.round(parseFloat(raw) * 100);
    } else {
      const n = Number(raw);
      if (!raw || !Number.isInteger(n) || n < 1 || n > 100) {
        return {
          error: "Enter the cancellation fee as a percentage, 1 to 100",
        };
      }
      cancellationFeeAmount = n;
    }
  }
  return {
    policy: {
      fullRefundWindow: d.fullRefundWindow,
      hasPartialRefund: d.hasPartialRefund,
      partialRefundWindow: d.hasPartialRefund ? d.partialRefundWindow : null,
      partialRefundPercentage,
      hasCancellationFee: d.hasCancellationFee,
      cancellationFeeType: d.hasCancellationFee ? d.cancellationFeeType : null,
      cancellationFeeAmount,
    },
  };
}

/** Default deposit typed in dollars → cents. "" = no default. */
export function parseDefaultDepositInput(
  input: string,
): { cents: number | null } | { error: string } {
  const raw = input.trim().replace(/^\$/, "");
  if (raw === "") return { cents: null };
  if (!/^\d+(\.\d{0,2})?$/.test(raw))
    return { error: "Enter the deposit in dollars, like 25 or 25.50" };
  const cents = Math.round(parseFloat(raw) * 100);
  if (cents === 0) return { cents: null };
  if (cents < MIN_DEPOSIT_CENTS)
    return { error: "Deposit must be at least $7.00." };
  return { cents };
}

export const depositInputFrom = (cents: number | null | undefined): string =>
  typeof cents === "number" && cents > 0 ? (cents / 100).toFixed(2) : "";

const TARGETS: SetupTarget[] = [
  "products",
  "services",
  "hours",
  "booking",
  "payouts",
];

/**
 * Server checklist → the hub's steps. Waiting steps (approval) are left out: the hub already shows
 * the approval banner. null when the answer can't be used, so the hub falls back to its own list.
 */
export function stepsFromSetupStatus(
  status: BusinessSetupStatus | null | undefined,
): SetupStep[] | null {
  if (!status || !Array.isArray(status.steps)) return null;
  const out: SetupStep[] = [];
  for (const s of status.steps) {
    if (!s || typeof s.key !== "string" || typeof s.label !== "string")
      continue;
    if (s.state === "waiting") continue;
    out.push({
      key: s.key,
      label: s.label,
      done: s.state === "done",
      target: TARGETS.includes(s.target as SetupTarget)
        ? (s.target as SetupTarget)
        : "payouts",
    });
  }
  return out;
}
