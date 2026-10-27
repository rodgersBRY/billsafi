import "server-only";
import {
  platformInfoSchema,
  type PlatformInfo,
  platformSettingDefaults,
} from "@billsafi/contracts";
import { cache } from "react";
import { apiInternalUrl } from "./request";

/** What to show when the API can't answer: open sign-ups, no banner, the built-in contact. */
export const platformFallback: PlatformInfo = {
  registration: { open: true, closedMessage: platformSettingDefaults.registration.closedMessage },
  announcement: null,
  supportContact: platformSettingDefaults.support_contact,
};

/**
 * The public platform facts (D065): whether sign-ups are open, the banner, the support
 * contact. Reads runtime data, so callers render inside <Suspense>. The API caches it for
 * 30 seconds. If it can't answer or the answer looks wrong, the fallback keeps every page
 * working, and an announcement is simply not shown.
 */
export const getPlatformInfo = cache(async (): Promise<PlatformInfo> => {
  try {
    const response = await fetch(`${apiInternalUrl}/api/v1/platform`, { cache: "no-store" });
    if (!response.ok) return platformFallback;
    const parsed = platformInfoSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : platformFallback;
  } catch {
    return platformFallback;
  }
});
