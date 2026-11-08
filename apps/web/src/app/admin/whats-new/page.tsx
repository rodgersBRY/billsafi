import type { AdminWhatsNewEntry, WhatsNewStatus } from "@billsafi/contracts";
import { Suspense } from "react";
import { AccessGate } from "@/components/admin/access-gate";
import { adminMetadata } from "@/components/admin/admin-metadata";
import { UpdatedAt } from "@/components/admin/admin-ui";
import { InfoPopover } from "@/components/admin/info-popover";
import { PageHeader } from "@/components/admin/page-header";
import { PageSkeleton } from "@/components/admin/page-skeleton";
import { EntryRowActions, NewEntryButton } from "@/components/admin/whats-new/entry-actions";
import { getAdminWhatsNew } from "@/lib/server-api/admin";

export const generateMetadata = () => adminMetadata("What's new");

const SECTIONS: { status: WhatsNewStatus; heading: string }[] = [
  { status: "draft", heading: "Drafts" },
  { status: "scheduled", heading: "Scheduled" },
  { status: "live", heading: "Live" },
];

function EntryRow({ entry }: { entry: AdminWhatsNewEntry }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium wrap-break-word">{entry.title}</p>
        <p className="text-xs text-sub">
          {entry.publishedAt
            ? new Date(entry.publishedAt).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })
            : "No publish time"}
          {entry.pro && " · Pro"}
          {entry.popup && " · Pops up"}
        </p>
      </div>
      <EntryRowActions entry={entry} />
    </li>
  );
}

async function WhatsNewAdmin() {
  const data = await getAdminWhatsNew();
  return (
    <>
      <PageHeader
        title="What's new"
        description="Product updates in the app."
        actions={
          <>
            <InfoPopover label="About What's new">
              <p>
                Live entries show in every user&apos;s panel. Pop up opens the panel on their next
                visit. Every change needs a reason and is audited.
              </p>
            </InfoPopover>
            <NewEntryButton />
          </>
        }
      />
      <div className="grid gap-4">
        {SECTIONS.map(({ status, heading }) => {
          const entries = data.entries.filter((entry) => entry.status === status);
          return (
            <section
              key={status}
              aria-labelledby={`whats-new-${status}`}
              className="rounded-panel border border-line bg-panel"
            >
              <h2
                id={`whats-new-${status}`}
                className="border-b border-line px-4 py-3 text-sm font-semibold"
              >
                {heading} ({entries.length})
              </h2>
              {entries.length === 0 ? (
                <p className="px-4 py-3 text-sm text-sub">None.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {entries.map((entry) => (
                    <EntryRow key={entry.id} entry={entry} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <div className="mt-4">
        <UpdatedAt iso={data.generatedAt} cached={false} />
      </div>
    </>
  );
}

export default function WhatsNewAdminPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccessGate>
        <WhatsNewAdmin />
      </AccessGate>
    </Suspense>
  );
}
