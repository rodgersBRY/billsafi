import { z } from "zod";
import { reasonSchema } from "./admin.js";

/** App pages an entry may link to, under /[businessId]/. */
export const whatsNewLinkSegments = [
  "overview",
  "quotes",
  "invoices",
  "recurring",
  "clients",
  "items",
  "settings",
  "billing",
] as const;
export const whatsNewLinkSegmentSchema = z.enum(whatsNewLinkSegments, {
  error: "Choose a page",
});
export type WhatsNewLinkSegment = z.infer<typeof whatsNewLinkSegmentSchema>;

/** Nav labels, used for the "Open Recurring" button. */
export const whatsNewLinkLabels: Record<WhatsNewLinkSegment, string> = {
  overview: "Overview",
  quotes: "Quotes",
  invoices: "Invoices",
  recurring: "Recurring",
  clients: "Clients",
  items: "Items",
  settings: "Settings",
  billing: "Billing",
};

export const WHATS_NEW_TITLE_MAX = 80;
export const WHATS_NEW_BODY_MAX = 500;
/** The panel lists this many entries, newest first. */
export const WHATS_NEW_FEED_LIMIT = 20;

const blankToNone = (value: unknown) => (value === "" || value === null ? undefined : value);

export const whatsNewEntryInputSchema = z.object({
  title: z
    .string({ error: "Enter a title" })
    .trim()
    .min(1, "Enter a title")
    .max(WHATS_NEW_TITLE_MAX, `Keep the title under ${WHATS_NEW_TITLE_MAX + 1} characters`),
  body: z
    .string({ error: "Enter the text" })
    .trim()
    .min(1, "Enter the text")
    .max(WHATS_NEW_BODY_MAX, `Keep the text under ${WHATS_NEW_BODY_MAX + 1} characters`),
  linkSegment: z.preprocess(blankToNone, whatsNewLinkSegmentSchema.optional()),
  pro: z.boolean().default(false),
  popup: z.boolean().default(false),
  /** Missing means draft. A future time means scheduled. */
  publishedAt: z.preprocess(
    blankToNone,
    z.iso
      .datetime({ offset: true, error: "Enter the publish time as an ISO date and time" })
      .optional(),
  ),
});
export type WhatsNewEntryInput = z.output<typeof whatsNewEntryInputSchema>;

/** Body of POST /admin/whats-new and PUT /admin/whats-new/:id. */
export const adminWhatsNewSaveSchema = whatsNewEntryInputSchema.extend({ reason: reasonSchema });
export type AdminWhatsNewSave = z.output<typeof adminWhatsNewSaveSchema>;

/** An entry as a user sees it. */
export interface WhatsNewEntry {
  id: string;
  title: string;
  body: string;
  linkSegment: WhatsNewLinkSegment | null;
  pro: boolean;
  publishedAt: string;
  unread: boolean;
}

/** GET /whats-new. */
export interface WhatsNewFeed {
  entries: WhatsNewEntry[];
  /** Unread among the listed entries. */
  unreadCount: number;
  /** Open the panel by itself on this visit. */
  popup: boolean;
}

export const whatsNewStatuses = ["draft", "scheduled", "live"] as const;
export type WhatsNewStatus = (typeof whatsNewStatuses)[number];

/** An entry as an admin sees it. */
export interface AdminWhatsNewEntry {
  id: string;
  title: string;
  body: string;
  linkSegment: WhatsNewLinkSegment | null;
  pro: boolean;
  popup: boolean;
  publishedAt: string | null;
  status: WhatsNewStatus;
  createdAt: string;
  updatedAt: string;
}

/** GET /admin/whats-new. */
export interface AdminWhatsNewList {
  entries: AdminWhatsNewEntry[];
  generatedAt: string;
}
