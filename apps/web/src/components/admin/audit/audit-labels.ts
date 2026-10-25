/* Plain-English names for audit actions and target types. Unknown ones show as stored. */

export const auditActionLabels: Record<string, string> = {
  "tenant.suspend": "Suspended account",
  "tenant.reactivate": "Reactivated account",
  "user.revoke_sessions": "Revoked sessions",
  "user.role_change": "Changed role",
};

export const auditTargetLabels: Record<string, string> = {
  account: "Account",
  user: "User",
};

export function actionLabel(action: string): string {
  return auditActionLabels[action] ?? action;
}

export function targetLabel(type: string): string {
  return auditTargetLabels[type] ?? type;
}

/** Who acted: their email, the system, or a removed user. */
export function actorLabel(actor: { userId: string | null; email: string | null }): string {
  if (!actor.userId) return "System";
  return actor.email ?? "Removed user";
}
