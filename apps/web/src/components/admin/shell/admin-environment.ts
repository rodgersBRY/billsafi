export const adminEnvironments = ["production", "staging", "development"] as const;
export type AdminEnvironment = (typeof adminEnvironments)[number];

/**
 * The deployment the admin is looking at, from NEXT_PUBLIC_APP_ENV (baked in at build).
 * Anything unset or unknown counts as development, so only a deliberate production build
 * says Production.
 */
export function adminEnvironment(value: string | undefined): AdminEnvironment {
  return adminEnvironments.find((name) => name === value?.trim().toLowerCase()) ?? "development";
}
