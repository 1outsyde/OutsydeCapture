export const ADMIN_EMAILS = [
  "info@goutsyde.com",
  "jamesmeyers2304@gmail.com",
] as const;

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase() as typeof ADMIN_EMAILS[number]);
}
