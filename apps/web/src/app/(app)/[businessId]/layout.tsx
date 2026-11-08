import { notFound } from "next/navigation";
import { Suspense } from "react";
import { shouldShowTour } from "@billsafi/contracts";
import { PlatformBanner } from "@/components/announcement/platform-banner";
import { AccountMenu } from "@/components/shell/account-menu";
import { AppShell } from "@/components/shell/app-shell";
import { BusinessSwitcher } from "@/components/shell/business-switcher";
import { NavLinks } from "@/components/shell/nav-links";
import { SidebarBrand } from "@/components/shell/sidebar-brand";
import { SidebarExpandedOnly } from "@/components/shell/sidebar-state";
import { UsageMeter } from "@/components/shell/usage-meter";
import { GettingStartedPanel } from "@/components/tour/getting-started";
import { getSessionUser } from "@/lib/server-api/auth";
import { getUsage } from "@/lib/server-api/billing";
import { listBusinesses } from "@/lib/server-api/businesses";
import { getGettingStarted, getProductTours } from "@/lib/server-api/product-tours";

async function Sidebar({ params }: { params: Promise<{ businessId: string }> }) {
  const [{ businessId }, businesses, usage, user] = await Promise.all([
    params,
    listBusinesses(),
    getUsage(),
    getSessionUser(),
  ]);
  // Only the account's own businesses can be opened; anything else is not found.
  if (!businesses.some((business) => business.id === businessId)) notFound();
  return (
    <>
      <BusinessSwitcher businesses={businesses} currentId={businessId} />
      <NavLinks businessId={businessId} isPro={usage.plan === "pro"} />
      <div className="mt-auto grid grid-cols-1 gap-3">
        <UsageMeter usage={usage} />
        <AccountMenu
          name={user.name}
          email={user.email}
          billingHref={`/${businessId}/billing`}
          settingsHref={`/${businessId}/settings`}
          tourHref={`/${businessId}/overview?tour=1`}
          isPro={usage.plan === "pro"}
          // Only shows the link; /admin itself is still checked by the proxy and the API.
          isAdmin={user.role === "admin"}
        />
        <SidebarExpandedOnly className="px-1 text-center text-xs text-sub">
          BillSafi v{process.env.NEXT_PUBLIC_APP_VERSION}
        </SidebarExpandedOnly>
      </div>
    </>
  );
}

/** Floating setup checklist until every step is done or the user hides it (D057). */
async function SetupChecklist({ params }: { params: Promise<{ businessId: string }> }) {
  const [{ businessId }, tours, progress] = await Promise.all([
    params,
    getProductTours(),
    getGettingStarted(),
  ]);
  const allDone = Object.values(progress).every(Boolean);
  if (allDone || !shouldShowTour(tours, "getting-started-checklist")) return null;

  return <GettingStartedPanel businessId={businessId} progress={progress} />;
}

export default function BusinessLayout({ children, params }: LayoutProps<"/[businessId]">) {
  return (
    <AppShell
      banner={
        <Suspense fallback={null}>
          <PlatformBanner />
        </Suspense>
      }
      sidebar={
        <>
          <SidebarBrand />
          <Suspense fallback={<div className="h-40 animate-pulse rounded-panel bg-soft" />}>
            <Sidebar params={params} />
          </Suspense>
        </>
      }
    >
      {children}
      <Suspense fallback={null}>
        <SetupChecklist params={params} />
      </Suspense>
    </AppShell>
  );
}
