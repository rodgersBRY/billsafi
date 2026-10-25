import type { ProState } from "./preview";

/** What the subscription dialogs need to know about the account to preview a change. */
export interface ActionContext {
  target: { id: string; name: string; detail: string };
  pro: ProState;
  /** Bought plus granted credits not used yet. */
  credits: number;
  /** The allowance window's limit now, overrides included. */
  limit: number;
}
