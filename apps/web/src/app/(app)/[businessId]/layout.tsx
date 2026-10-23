import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccountMenu } from "@/components/shell/account-menu";
import { AppShell } from "@/components/shell/app-shell";
import { BusinessSwitcher } from "@/components/shell/business-switcher";
import { NavLinks } from "@/components/shell/nav-links";
import { UsageMeter } from "@/components/shell/usage-meter";
import { BrandMark } from "@/components/ui/brand-mark";
import { getSessionUser } from "@/lib/server-api/auth";
import { getUsage } from "@/lib/server-api/billing";
import { listBusinesses } from "@/lib/server-api/businesses";

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
      <NavLinks businessId={businessId} />
      <div className="mt-auto grid gap-3">
        <UsageMeter usage={usage} />
        <AccountMenu
          name={user.name}
          email={user.email}
          billingHref={`/${businessId}/billing`}
          settingsHref={`/${businessId}/settings`}
          tourHref={`/${businessId}/overview?tour=1`}
          isPro={usage.plan === "pro"}
        />
        <p className="px-1 text-xs text-sub">Billsafi v{process.env.NEXT_PUBLIC_APP_VERSION}</p>
      </div>
    </>
  );
}

export default function BusinessLayout({ children, params }: LayoutProps<"/[businessId]">) {
  return (
    <AppShell
      sidebar={
        <>
          <BrandMark size={28} />
          <Suspense fallback={<div className="h-40 animate-pulse rounded-panel bg-soft" />}>
            <Sidebar params={params} />
          </Suspense>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
