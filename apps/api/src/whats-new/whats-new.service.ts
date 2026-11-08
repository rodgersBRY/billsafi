import { Inject, Injectable } from "@nestjs/common";
import {
  PRODUCT_TOUR_VERSIONS,
  WHATS_NEW_FEED_LIMIT,
  type WhatsNewFeed,
} from "@billsafi/contracts";
import { and, type DatabaseConnection, desc, eq, isNotNull, lte, schema } from "@billsafi/db";
import { shouldPopUpWhatsNew, whatsNewSeenSince } from "@billsafi/domain";
import { DATABASE } from "../database/database.module.js";
import { toWhatsNewEntry } from "./whats-new.mapper.js";

const { whatsNewEntries, userWhatsNew, users, userProductTours } = schema;

/** The What's new feed and each user's last-seen time (D084). */
@Injectable()
export class WhatsNewService {
  constructor(@Inject(DATABASE) private readonly connection: DatabaseConnection) {}

  async feed(userId: string, now = new Date()): Promise<WhatsNewFeed> {
    const db = this.connection.db;
    const [rows, [user], [tour]] = await Promise.all([
      db
        .select()
        .from(whatsNewEntries)
        .where(and(isNotNull(whatsNewEntries.publishedAt), lte(whatsNewEntries.publishedAt, now)))
        .orderBy(desc(whatsNewEntries.publishedAt), desc(whatsNewEntries.id))
        .limit(WHATS_NEW_FEED_LIMIT),
      db
        .select({ createdAt: users.createdAt, seenAt: userWhatsNew.seenAt })
        .from(users)
        .leftJoin(userWhatsNew, eq(userWhatsNew.userId, users.id))
        .where(eq(users.id, userId)),
      db
        .select({ version: userProductTours.version })
        .from(userProductTours)
        .where(and(eq(userProductTours.userId, userId), eq(userProductTours.tourKey, "first-run"))),
    ]);

    const seenSince = whatsNewSeenSince(user?.seenAt ?? null, user?.createdAt ?? now);
    const firstRunDue = !tour || tour.version < PRODUCT_TOUR_VERSIONS["first-run"];
    const entries = rows.map((row) => toWhatsNewEntry(row, seenSince));
    const live = rows.map((row) => ({ publishedAt: row.publishedAt!, popup: row.popup }));

    return {
      entries,
      unreadCount: entries.filter((entry) => entry.unread).length,
      popup: shouldPopUpWhatsNew(live, seenSince, firstRunDue),
    };
  }

  async markSeen(userId: string, now = new Date()): Promise<void> {
    await this.connection.db
      .insert(userWhatsNew)
      .values({ userId, seenAt: now })
      .onConflictDoUpdate({ target: userWhatsNew.userId, set: { seenAt: now, updatedAt: now } });
  }
}
