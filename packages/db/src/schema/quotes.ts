import { relations, sql } from "drizzle-orm";
import {
  char,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { businesses } from "./businesses.js";
import { clients } from "./clients.js";
import { id, timestamps } from "./columns.js";
import { type BusinessSnapshot, type ClientSnapshot, discountType, invoices } from "./invoices.js";

const amount = (name: string) => numeric(name, { precision: 14, scale: 2 });

export const quoteStatus = pgEnum("quote_status", [
  "draft",
  "sent",
  "accepted",
  "declined",
  "withdrawn",
  "converted",
]);

export const quoteDecision = pgEnum("quote_decision", ["accepted", "declined"]);

/** Shape lives in @billsafi/contracts as QuoteVersionContent. */
export type QuoteVersionSnapshot = {
  quoteNumber: string;
  issueDate: string;
  validUntil: string;
  currency: string;
  client: ClientSnapshot;
  business: BusinessSnapshot;
  items: { position: number; description: string; quantity: string; unitPrice: string; lineTotal: string }[];
  discount: { type: "fixed" | "percentage"; value: string } | null;
  taxRate: string | null;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  total: string;
  notes: string | null;
};

export const quotes = pgTable(
  "quotes",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "restrict" }),
    clientId: uuid("client_id").notNull(),
    status: quoteStatus("status").notNull().default("draft"),
    /** Assigned on first send; never reused. */
    sequenceNumber: integer("sequence_number"),
    quoteNumber: text("quote_number"),
    systemQuoteNumber: text("system_quote_number"),
    reservedQuoteNumbers: text("reserved_quote_numbers")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    issueDate: date("issue_date").notNull(),
    validUntil: date("valid_until").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("KES"),
    discountType: discountType("discount_type"),
    discountValue: amount("discount_value"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }),
    subtotal: amount("subtotal").notNull().default("0"),
    discountAmount: amount("discount_amount").notNull().default("0"),
    taxAmount: amount("tax_amount").notNull().default("0"),
    total: amount("total").notNull().default("0"),
    notes: text("notes"),
    clientSnapshot: jsonb("client_snapshot").$type<ClientSnapshot>(),
    businessSnapshot: jsonb("business_snapshot").$type<BusinessSnapshot>(),
    currentVersion: integer("current_version"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    declinedAt: timestamp("declined_at", { withTimezone: true }),
    declineReason: text("decline_reason"),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    /** One invoice per quote. Cleared, with status back to accepted, if that draft is deleted. */
    convertedInvoiceId: uuid("converted_invoice_id")
      .unique()
      .references(() => invoices.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (table) => [
    foreignKey({
      name: "quotes_client_same_business_fk",
      columns: [table.clientId, table.businessId],
      foreignColumns: [clients.id, clients.businessId],
    }).onDelete("restrict"),
    unique("quotes_id_business_id_unique").on(table.id, table.businessId),
    unique("quotes_business_sequence_unique").on(table.businessId, table.sequenceNumber),
    unique("quotes_business_number_unique").on(table.businessId, table.quoteNumber),
    index("quotes_business_status_valid_idx").on(table.businessId, table.status, table.validUntil),
    index("quotes_business_client_idx").on(table.businessId, table.clientId),
    check("quotes_valid_after_issue", sql`${table.validUntil} >= ${table.issueDate}`),
    check(
      "quotes_discount_pair",
      sql`(${table.discountType} is null) = (${table.discountValue} is null)`,
    ),
    check(
      "quotes_number_once_sent",
      sql`(${table.status} = 'draft') = (${table.sequenceNumber} is null)
        and (${table.status} = 'draft' or ${table.quoteNumber} is not null)`,
    ),
    check("quotes_tax_rate_range", sql`${table.taxRate} between 0 and 100`),
  ],
);

export const quoteItems = pgTable(
  "quote_items",
  {
    id: id(),
    businessId: uuid("business_id").notNull(),
    quoteId: uuid("quote_id").notNull(),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    unitPrice: amount("unit_price").notNull(),
    lineTotal: amount("line_total").notNull(),
  },
  (table) => [
    foreignKey({
      name: "quote_items_quote_same_business_fk",
      columns: [table.quoteId, table.businessId],
      foreignColumns: [quotes.id, quotes.businessId],
    }).onDelete("cascade"),
    unique("quote_items_quote_position_unique").on(table.quoteId, table.position),
    check("quote_items_quantity_positive", sql`${table.quantity} > 0`),
    check("quote_items_unit_price_non_negative", sql`${table.unitPrice} >= 0`),
  ],
);

/** What the client could see at each version. Never edited. */
export const quoteVersions = pgTable(
  "quote_versions",
  {
    id: id(),
    businessId: uuid("business_id").notNull(),
    quoteId: uuid("quote_id").notNull(),
    version: integer("version").notNull(),
    content: jsonb("content").$type<QuoteVersionSnapshot>().notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "quote_versions_quote_same_business_fk",
      columns: [table.quoteId, table.businessId],
      foreignColumns: [quotes.id, quotes.businessId],
    }).onDelete("cascade"),
    unique("quote_versions_quote_version_unique").on(table.quoteId, table.version),
    check("quote_versions_positive", sql`${table.version} >= 1`),
  ],
);

/** Each client response. A decline and a later accept are both kept. */
export const quoteAcceptances = pgTable(
  "quote_acceptances",
  {
    id: id(),
    businessId: uuid("business_id").notNull(),
    quoteId: uuid("quote_id").notNull(),
    quoteVersionId: uuid("quote_version_id")
      .notNull()
      .references(() => quoteVersions.id, { onDelete: "restrict" }),
    decision: quoteDecision("decision").notNull(),
    signerName: text("signer_name"),
    reason: text("reason"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    /** Reserved for an email or SMS code step. Null until one exists. */
    verificationMethod: text("verification_method"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "quote_acceptances_quote_same_business_fk",
      columns: [table.quoteId, table.businessId],
      foreignColumns: [quotes.id, quotes.businessId],
    }).onDelete("cascade"),
    index("quote_acceptances_quote_idx").on(table.quoteId, table.createdAt),
    check(
      "quote_acceptances_signer_on_accept",
      sql`(${table.decision} = 'accepted') = (${table.signerName} is not null)`,
    ),
  ],
);

/** Public quote links. Only a hash of the token is stored. Expiry comes from the quote. */
export const quoteLinks = pgTable(
  "quote_links",
  {
    id: id(),
    businessId: uuid("business_id").notNull(),
    quoteId: uuid("quote_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "quote_links_quote_same_business_fk",
      columns: [table.quoteId, table.businessId],
      foreignColumns: [quotes.id, quotes.businessId],
    }).onDelete("cascade"),
    index("quote_links_quote_idx").on(table.quoteId),
  ],
);

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  business: one(businesses, { fields: [quotes.businessId], references: [businesses.id] }),
  client: one(clients, { fields: [quotes.clientId], references: [clients.id] }),
  items: many(quoteItems),
}));

export const quoteItemsRelations = relations(quoteItems, ({ one }) => ({
  quote: one(quotes, { fields: [quoteItems.quoteId], references: [quotes.id] }),
}));
