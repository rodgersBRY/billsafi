import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccountMenu } from "@/components/shell/account-menu";
import { AppShell } from "@/components/shell/app-shell";
import { BusinessSwitcher } from "@/components/shell/business-switcher";
import { NavLinks } from "@/components/shell/nav-links";
import { BrandMark } from "@/components/ui/brand-mark";
import { getSessionUser, listBusinesses } from "@/lib/api.server";

async function Sidebar({ params }: { params: Promise<{ businessId: string }> }) {
  const [{ businessId }, businesses] = await Promise.all([params, listBusinesses()]);
  // Only the account's own businesses can be opened; anything else is not found.
  if (!businesses.some((business) => business.id === businessId)) notFound();
  return (
    <>
      <BusinessSwitcher businesses={businesses} currentId={businessId} />
      <NavLinks businessId={businessId} />
    </>
  );
}

async function Account() {
  const user = await getSessionUser();
  return <AccountMenu name={user.name} email={user.email} />;
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
      account={
        <Suspense fallback={<div className="size-7.5 rounded-full bg-soft" />}>
          <Account />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
