import { relations, sql } from "drizzle-orm";
import {
  char,
  check,
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { id, timestamps } from "./columns.js";

export const businessProfileType = pgEnum("business_profile_type", ["individual", "business"]);

/** A tenant. V1 businesses are managed only by their owning account (D016). */
export const businesses = pgTable(
  "businesses",
  {
    id: id(),
    // No cascade: deleting an account must never remove issued financial records.
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    profileType: businessProfileType("profile_type").notNull(),
    displayName: text("display_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    phone: text("phone").notNull(),
    address: text("address"),
    kraPin: text("kra_pin"),
    logoKey: text("logo_key"),
    defaultCurrency: char("default_currency", { length: 3 }).notNull().default("KES"),
    defaultPaymentTermsDays: integer("default_payment_terms_days").notNull().default(14),
    nextInvoiceSequence: integer("next_invoice_sequence").notNull().default(1),
    ...timestamps(),
  },
  (table) => [
    index("businesses_owner_user_id_idx").on(table.ownerUserId),
    check("businesses_phone_format", sql`${table.phone} ~ '^\\+254[17][0-9]{8}$'`),
    check(
      "businesses_payment_terms_range",
      sql`${table.defaultPaymentTermsDays} between 0 and 365`,
    ),
    check("businesses_next_invoice_sequence_positive", sql`${table.nextInvoiceSequence} >= 1`),
  ],
);

export const paymentMethod = pgEnum("payment_method", [
  "mpesa_personal",
  "mpesa_till",
  "mpesa_paybill",
  "bank_transfer",
]);

/**
 * How clients pay a business outside Billsafi. M-Pesa methods carry a number;
 * bank transfer relies on the free-text instructions, matching the approved
 * onboarding design until bank fields are decided.
 */
export const businessPaymentInstructions = pgTable(
  "business_payment_instructions",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "restrict" }),
    method: paymentMethod("method").notNull(),
    accountNumber: text("account_number"),
    instructions: text("instructions"),
    ...timestamps(),
  },
  (table) => [
    index("business_payment_instructions_business_id_idx").on(table.businessId),
    check(
      "business_payment_instructions_details_present",
      sql`(${table.method} = 'bank_transfer' and ${table.instructions} is not null)
        or (${table.method} <> 'bank_transfer' and ${table.accountNumber} is not null)`,
    ),
  ],
);

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  owner: one(users, { fields: [businesses.ownerUserId], references: [users.id] }),
  paymentInstructions: many(businessPaymentInstructions),
}));

export const businessPaymentInstructionsRelations = relations(
  businessPaymentInstructions,
  ({ one }) => ({
    business: one(businesses, {
      fields: [businessPaymentInstructions.businessId],
      references: [businesses.id],
    }),
  }),
);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

/**
 * Uploaded logos (D052). Rows are never changed: a new upload adds a row and
 * points `businesses.logo_key` at it, so issued invoices keep their logo.
 */
export const businessLogos = pgTable(
  "business_logos",
  {
    id: id(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "restrict" }),
    contentType: text("content_type").notNull(),
    data: bytea("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("business_logos_business_id_idx").on(table.businessId),
    check("business_logos_type", sql`${table.contentType} in ('image/png', 'image/jpeg')`),
    check("business_logos_size", sql`octet_length(${table.data}) <= 524288`),
  ],
);
