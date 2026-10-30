/** Seed accounts are reserved for local development, including existing JWT sessions. */
export function isDevelopmentAccount(email: string | null | undefined): boolean {
  return Boolean(email?.trim().toLowerCase().endsWith("@adv-hr.local"));
}
