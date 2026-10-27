import { Inject, Injectable } from "@nestjs/common";
import {
  type AdminSetting,
  type AdminSettings,
  type AdminSettingUpdate,
  type AdminActionAck,
  type PlatformSettingKey,
  platformSettingDefaults,
  platformSettingKeys,
  platformSettingLabels,
} from "@billsafi/contracts";
import { type DatabaseConnection, eq, schema } from "@billsafi/db";
import { DATABASE } from "../../database/database.module.js";
import { PLATFORM_CACHE } from "../../platform/platform-cache.js";
import { parseSetting } from "../../platform/platform-settings.js";
import {
  type AdminActionContext,
  AdminActionRunner,
  UnauditedRefusal,
} from "../shared/admin-action-runner.js";
import type { TtlCache } from "../shared/ttl-cache.js";

const { platformSettings, users } = schema;

/** JSON with sorted keys, so two equal values compare equal whatever their key order. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
}

@Injectable()
export class AdminSettingsService {
  constructor(
    @Inject(DATABASE) private readonly connection: DatabaseConnection,
    private readonly runner: AdminActionRunner,
    @Inject(PLATFORM_CACHE) private readonly platformCache: TtlCache,
  ) {}

  private async rows() {
    return this.connection.db
      .select({
        key: platformSettings.key,
        value: platformSettings.value,
        updatedAt: platformSettings.updatedAt,
        updatedById: users.id,
        updatedByName: users.name,
        updatedByEmail: users.email,
      })
      .from(platformSettings)
      .leftJoin(users, eq(users.id, platformSettings.updatedBy));
  }

  async list(now = new Date()): Promise<AdminSettings> {
    const rows = await this.rows();
    const settings = platformSettingKeys.map((key) => this.toSetting(key, rows));
    return { settings, generatedAt: now.toISOString() };
  }

  async get(key: PlatformSettingKey): Promise<AdminSetting> {
    return this.toSetting(key, await this.rows());
  }

  private toSetting(
    key: PlatformSettingKey,
    rows: Awaited<ReturnType<AdminSettingsService["rows"]>>,
  ): AdminSetting {
    const row = rows.find((candidate) => candidate.key === key);
    const value = parseSetting(key, row?.value);
    const fallback = platformSettingDefaults[key];
    return {
      key,
      label: platformSettingLabels[key],
      value,
      default: fallback,
      isDefault: !row || canonical(value) === canonical(fallback),
      updatedBy: row?.updatedById
        ? { id: row.updatedById, name: row.updatedByName!, email: row.updatedByEmail! }
        : null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    } as AdminSetting;
  }

  async update(
    context: AdminActionContext,
    key: PlatformSettingKey,
    body: AdminSettingUpdate,
  ): Promise<AdminSetting | AdminActionAck> {
    await this.runner.perform(
      context,
      { action: "settings.update", target: { type: "setting", id: key } },
      async (tx) => {
        const [current] = await tx
          .select({ value: platformSettings.value })
          .from(platformSettings)
          .where(eq(platformSettings.key, key))
          .for("update");
        const before = parseSetting(key, current?.value);
        if (canonical(before) === canonical(body.value)) {
          // Nothing to record: no audit row, no cache clear.
          throw new UnauditedRefusal({ code: "NO_CHANGE", message: "Nothing changed." });
        }
        const now = new Date();
        await tx
          .insert(platformSettings)
          .values({ key, value: body.value, updatedBy: context.adminId, updatedAt: now })
          .onConflictDoUpdate({
            target: platformSettings.key,
            set: { value: body.value, updatedBy: context.adminId, updatedAt: now },
          });
        return { value: { from: before, to: body.value } };
      },
    );
    // The public page may be showing the old value; the admin cache is cleared by the runner.
    this.platformCache.invalidate("");
    return this.runner.summaryAfter(context.adminId, () => this.get(key));
  }
}
