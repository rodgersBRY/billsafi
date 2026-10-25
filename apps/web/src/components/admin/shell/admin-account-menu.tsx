"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AccountMenuFrame, accountMenuItem } from "@/components/shell/account-menu-frame";

/** The same bottom-of-sidebar account menu as the app, with a way back to the app. */
export function AdminAccountMenu({
  user,
  compact = false,
}: {
  user: { name: string; email: string };
  compact?: boolean;
}) {
  return (
    <AccountMenuFrame name={user.name} email={user.email} compact={compact}>
      <Link href="/" className={accountMenuItem}>
        Back to app
        <ArrowLeft aria-hidden className="size-4 text-sub" />
      </Link>
    </AccountMenuFrame>
  );
}
