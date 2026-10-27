import { getPlatformInfo } from "@/lib/server-api/platform";
import { AnnouncementBanner } from "./announcement-banner";

/** The live announcement, if there is one. Render inside <Suspense fallback={null}>. */
export async function PlatformBanner() {
  const { announcement } = await getPlatformInfo();
  if (!announcement) return null;
  return <AnnouncementBanner {...announcement} />;
}
