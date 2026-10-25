import type { AdminSignInMethod } from "@billsafi/contracts";
import { formatRelative } from "../admin-format";

export const signInMethodLabels: Record<AdminSignInMethod, string> = {
  email: "Email",
  google: "Google",
};

export function methodsText(methods: AdminSignInMethod[]): string {
  return methods.map((method) => signInMethodLabels[method]).join(", ") || "None";
}

export function lastLoginText(iso: string | null): string {
  return iso ? formatRelative(iso) : "No recent session";
}
