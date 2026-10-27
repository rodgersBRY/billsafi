"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AccountMenuFrame, accountMenuItem } from "@/components/shell/account-menu-frame";
import type { SidebarMode } from "@/components/shell/sidebar-mode";

/** The same bottom-of-sidebar account menu as the app, with a way back to the app. */
export function AdminAccountMenu({
  user,
  mode = "full",
}: {
  user: { name: string; email: string };
  mode?: SidebarMode;
}) {
  return (
    <AccountMenuFrame name={user.name} email={user.email} mode={mode}>
      <Link href="/" className={accountMenuItem}>
        Back to app
        <ArrowLeft aria-hidden className="size-4 text-sub" />
      </Link>
    </AccountMenuFrame>
  );
}
