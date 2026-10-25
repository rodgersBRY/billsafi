import type { ConfirmAction } from "./confirm-action-dialog";

/* The confirm dialogs for the account and user actions, worded once for every page. */

export interface ActionTarget {
  id: string;
  name: string;
  email: string;
}

export function suspendAction(target: ActionTarget): ConfirmAction {
  return {
    title: "Suspend this account?",
    target: { name: target.name, detail: target.email },
    impact: [
      "They can't sign in, and every session they have ends now.",
      "Invoice links they already sent keep working.",
      "Nothing is deleted. You can reactivate the account later.",
    ],
    confirmLabel: "Suspend account",
    path: `/admin/tenants/${encodeURIComponent(target.id)}/suspend`,
    successMessage: `${target.name}'s account is suspended.`,
    destructive: true,
  };
}

export function reactivateAction(target: ActionTarget): ConfirmAction {
  return {
    title: "Reactivate this account?",
    target: { name: target.name, detail: target.email },
    impact: ["They can sign in again.", "Their businesses, invoices and plan are unchanged."],
    confirmLabel: "Reactivate account",
    path: `/admin/tenants/${encodeURIComponent(target.id)}/reactivate`,
    successMessage: `${target.name}'s account is active again.`,
  };
}

export function revokeSessionsAction(target: ActionTarget): ConfirmAction {
  return {
    title: "Sign this user out everywhere?",
    target: { name: target.name, detail: target.email },
    impact: [
      "Every session they have ends now, on every device.",
      "They can sign in again straight away. Suspend the account to block sign-in.",
    ],
    confirmLabel: "Revoke sessions",
    path: `/admin/users/${encodeURIComponent(target.id)}/revoke-sessions`,
    successMessage: `${target.name} is signed out everywhere.`,
    destructive: true,
  };
}

/** Why an account action is off for this target, or null when it is allowed. */
export function accountActionBlock(options: { isSelf: boolean; isAdmin?: boolean }) {
  if (options.isSelf) return "You can't suspend your own account.";
  if (options.isAdmin) return "Admins can't be suspended. Remove them from ADMIN_USER_IDS first.";
  return null;
}
