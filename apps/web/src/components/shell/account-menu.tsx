"use client";

import { Compass, CreditCard, Settings, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { START_TOUR_EVENT } from "@/components/tour/product-tour";
import { AccountMenuFrame, accountMenuItem } from "./account-menu-frame";

/** The app's account menu at the bottom of the sidebar. */
export function AccountMenu({
  name,
  email,
  billingHref,
  settingsHref,
  tourHref,
  isPro,
  isAdmin = false,
}: {
  name: string;
  email: string;
  billingHref: string;
  settingsHref: string;
  /** Overview with the product tour queued (D057). */
  tourHref: string;
  isPro: boolean;
  /** Platform admins get a link to the admin dashboard. */
  isAdmin?: boolean;
}) {
  const pathname = usePathname();

  // On the Overview already, start the tour in place; navigating to the same page
  // with the same props would not restart it.
  function startTour(event: React.MouseEvent<HTMLAnchorElement>) {
    if (pathname === tourHref.split("?")[0]) {
      event.preventDefault();
      window.dispatchEvent(new Event(START_TOUR_EVENT));
    }
  }

  return (
    <AccountMenuFrame
      name={name}
      email={email}
      dataTour="account-menu"
      footer={
        !isPro && (
          <Link
            href={billingHref}
            className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-lg bg-teal px-2.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal/90"
          >
            <Sparkles aria-hidden className="size-4" />
            Upgrade to Pro
          </Link>
        )
      }
    >
      {isPro && (
        <Link href={billingHref} className={accountMenuItem}>
          Billing
          <CreditCard aria-hidden className="size-4 text-sub" />
        </Link>
      )}
      <Link href={settingsHref} className={accountMenuItem}>
        Settings
        <Settings aria-hidden className="size-4 text-sub" />
      </Link>
      {isAdmin && (
        <Link href="/admin" className={accountMenuItem}>
          Admin dashboard
          <ShieldCheck aria-hidden className="size-4 text-sub" />
        </Link>
      )}
      <Link href={tourHref} onClick={startTour} className={accountMenuItem}>
        Take the tour
        <Compass aria-hidden className="size-4 text-sub" />
      </Link>
    </AccountMenuFrame>
  );
}
