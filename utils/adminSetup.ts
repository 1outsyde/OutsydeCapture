// Admin account setup emails in the app (App Admin Step 7c). Labels and filters copied from goutsyde.com
// app/admin/emails/AccountSetupTab.tsx. Each reminder number is reserved by the backend before it is
// sent (account_setup_reminders ON CONFLICT (user_id, reminder_number) DO NOTHING), so a retry, the web
// or the hourly job can never email the same reminder twice. Test: npx tsx utils/adminSetup.test.ts

export type SetupTemplate = "claim" | "steps_left";
export type SetupStep = "password" | "username" | "approval" | "plan" | "payouts";
export type SetupFilter = "all" | "claim" | "payouts" | "plan" | "username";

export interface DueReminder {
  userId: string;
  email: string;
  displayName: string | null;
  role: string;
  reminderNumber: number;
  template: SetupTemplate;
  steps: SetupStep[];
  channels: ("email" | "push")[];
  outcome: string;
  error?: string;
}

export interface SetupEmailPreview {
  subject: string;
  text: string;
  template: SetupTemplate;
  reminderNumber: number;
  email: string;
}

export interface SetupSendResult {
  sent: DueReminder[];
  failed: DueReminder[];
  notDue: string[];
}

/** Backend MAX_PICKED_USERS (server/routes/accountSetup.ts). */
export const MAX_SETUP_PICKED = 200;

export const SETUP_FILTERS: { key: SetupFilter; label: string; match: (r: DueReminder) => boolean }[] = [
  { key: "all", label: "All due", match: () => true },
  { key: "claim", label: "Claim account", match: (r) => r.template === "claim" },
  { key: "payouts", label: "Payouts", match: (r) => r.steps.includes("payouts") },
  { key: "plan", label: "Plan", match: (r) => r.steps.includes("plan") },
  { key: "username", label: "Username", match: (r) => r.steps.includes("username") },
];

export const SETUP_STEP_LABEL: Record<SetupStep, string> = {
  password: "Password",
  username: "Username",
  approval: "Approval",
  plan: "Plan",
  payouts: "Payouts",
};

export const SETUP_TEMPLATE_LABEL: Record<SetupTemplate, string> = {
  claim: "Claim email",
  steps_left: "Steps left email",
};

export function setupOrdinal(n: number): string {
  return n === 1 ? "1st email" : n === 2 ? "2nd email" : n === 3 ? "3rd email" : `${n}th email`;
}

export function setupName(r: Pick<DueReminder, "displayName" | "email">): string {
  return r.displayName?.trim() || r.email;
}

/**
 * The exact body the app sends: dryRun false (the backend defaults to a dry run) and the ticked ids
 * only (without userIds the backend emails EVERYONE due). Throws on an empty or oversized list so a
 * caller can never fall into either default.
 */
export function setupSendBody(picked: Iterable<string>): { dryRun: false; userIds: string[] } {
  const userIds = Array.from(new Set(Array.from(picked).filter((v) => typeof v === "string" && v.length > 0 && v.length <= 100)));
  if (userIds.length === 0) throw new Error("Tick at least one person.");
  if (userIds.length > MAX_SETUP_PICKED) throw new Error(`Tick at most ${MAX_SETUP_PICKED} people at a time.`);
  return { dryRun: false, userIds };
}

/** Web send(): sent, failed, and not due (skipped by the backend or already handled). */
export function setupSendResult(data: { reminders?: unknown; notDue?: unknown }): SetupSendResult {
  const reminders: DueReminder[] = Array.isArray(data?.reminders) ? (data.reminders as DueReminder[]) : [];
  return {
    sent: reminders.filter((r) => r.outcome === "sent"),
    failed: reminders.filter((r) => r.outcome === "failed"),
    notDue: [
      ...(Array.isArray(data?.notDue) ? (data.notDue as string[]) : []),
      ...reminders.filter((r) => r.outcome === "skipped_recently_claimed").map((r) => r.userId),
    ],
  };
}
