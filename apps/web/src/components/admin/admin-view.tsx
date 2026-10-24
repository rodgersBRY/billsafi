import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/ui/brand-mark";
import {
  getAdminBilling,
  getAdminFunnel,
  getAdminOverview,
  getAdminRetention,
  getAdminUser,
  getAdminUsers,
} from "@/lib/server-api/admin";
import { AdminLink } from "./admin-link";
import { type AdminState, adminHref, adminTabLabels, adminTabs } from "./admin-params";
import { BillingTab } from "./billing-tab";
import { FunnelTab } from "./funnel-tab";
import { OverviewTab } from "./overview-tab";
import { RetentionTab } from "./retention-tab";
import { UserDetail } from "./user-detail";
import { UsersTab } from "./users-tab";

/**
 * Fetches the active tab's data, which is also the access check: a 404 from
 * the API ends in the not-found page. Fetches are memoised per request.
 */
export async function fetchActiveTab(state: AdminState): Promise<void> {
  await loadTab(state);
}

/** Fetches the active tab and returns its content. */
async function loadTab(state: AdminState): Promise<React.ReactNode> {
  switch (state.tab) {
    case "overview":
      return <OverviewTab data={await getAdminOverview()} />;
    case "funnel":
      return <FunnelTab data={await getAdminFunnel(state.days)} state={state} />;
    case "retention":
      return <RetentionTab data={await getAdminRetention(state.weeks)} state={state} />;
    case "users":
      return state.user ? (
        <UserDetail data={await getAdminUser(state.user)} state={state} />
      ) : (
        <UsersTab data={await getAdminUsers(state.page, state.search)} state={state} />
      );
    case "billing":
      return <BillingTab data={await getAdminBilling()} />;
  }
}

/**
 * The dashboard shell and the active tab. The API decides who may see it, so
 * nothing is rendered until the tab's data has come back: a non-admin gets the
 * not-found page without the header or tabs ever reaching the browser.
 */
export async function AdminView({ state }: { state: AdminState }) {
  const content = await loadTab(state);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-7">
          <div className="flex items-center gap-3">
            <BrandMark size={28} />
            <span className="rounded-md bg-soft px-2 py-0.5 text-sm font-medium text-accent">
              Admin
            </span>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-panel px-2.5 py-2 text-sm text-sub hover:bg-soft hover:text-ink"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Back to app
          </Link>
        </div>
        <nav
          aria-label="Dashboard sections"
          className="mx-auto max-w-6xl overflow-x-auto px-2 sm:px-5"
        >
          <ul className="flex gap-1">
            {adminTabs.map((tab) => (
              <li key={tab}>
                <AdminLink
                  href={adminHref(state, { tab, user: undefined })}
                  current={tab === state.tab}
                  className="border-b-2 border-transparent px-2.5 py-2.5 text-sm whitespace-nowrap text-sub hover:text-ink aria-[current=page]:border-teal aria-[current=page]:font-medium aria-[current=page]:text-ink"
                >
                  {adminTabLabels[tab]}
                </AdminLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-7">
        <h1 className="sr-only">{adminTabLabels[state.tab]}</h1>
        {content}
      </main>
    </div>
  );
}
