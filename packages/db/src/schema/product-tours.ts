import { relations } from "drizzle-orm";
import { integer, pgEnum, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { timestamps } from "./columns.js";

export const productTourStatus = pgEnum("product_tour_status", ["completed", "dismissed"]);

/** Which product tours an account has finished or skipped (D057). */
export const userProductTours = pgTable(
  "user_product_tours",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tourKey: text("tour_key").notNull(),
    /** Tour version the user saw; a newer version shows the tour again. */
    version: integer("version").notNull(),
    status: productTourStatus("status").notNull(),
    lastStep: integer("last_step").notNull().default(0),
    ...timestamps(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.tourKey] })],
);

export const userProductToursRelations = relations(userProductTours, ({ one }) => ({
  user: one(users, { fields: [userProductTours.userId], references: [users.id] }),
}));
