import { notFound } from "next/navigation";
import { Suspense } from "react";
import { adminMetadata } from "@/components/admin/admin-metadata";
import { supportHref, tenantHref } from "@/components/admin/admin-params";
import { Panel, UpdatedAt } from "@/components/admin/admin-ui";
import { CopyButton } from "@/components/admin/copy-button";
import { PageSkeleton } from "@/components/admin/page-skeleton";
import { formatDay, formatInstant } from "@/components/admin/admin-format";
import { StatusBadge } from "@/components/admin/status-badge";
import { CaseActions } from "@/components/admin/support/case-actions";
import { CaseDiagnostics } from "@/components/admin/support/case-diagnostics";
import { CaseTimeline } from "@/components/admin/support/case-timeline";
import { NoteBox } from "@/components/admin/support/note-box";
import { assigneeText } from "@/components/admin/support/support-text";
import { getAdminAccess, getAdminSelf, getAdminSupportCase } from "@/lib/server-api/admin";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadCase(params: Promise<{ id: string }>) {
  const { id } = await params;
  // Admin access first, so a malformed id can't tell a non-admin the area exists.
  await getAdminAccess();
  if (!UUID.test(id)) notFound();
  return getAdminSupportCase(id);
}

export async function generateMetadata({ params }: PageProps<"/admin/support/[id]">) {
  const data = await loadCase(params);
  return adminMetadata(`${data.case.title} · Support`);
}

async function CaseDetail({ params }: PageProps<"/admin/support/[id]">) {
  const [data, self] = await Promise.all([loadCase(params), getAdminSelf()]);
  const row = data.case;
  return (
    <>
      <Link
        href={supportHref()}
        className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm text-accent hover:underline md:min-h-0"
      >
        <ArrowLeft aria-hidden className="size-4" />
        All cases
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-80">
          <h1 className="text-2xl font-semibold tracking-tight break-words">{row.title}</h1>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <StatusBadge kind="supportStatus" value={row.status} labelled />
            <StatusBadge kind="severity" value={row.severity} labelled />
            <StatusBadge kind="category" value={row.category} labelled />
          </div>
          <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <div className="flex min-w-0 gap-1">
              <dt className="text-sub">Account</dt>
              <dd className="min-w-0 break-words">
                <Link href={tenantHref(row.accountId)} className="text-accent hover:underline">
                  {row.account.name}
                </Link>
              </dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-sub">Assigned to</dt>
              <dd className="break-words">{assigneeText(row.assignedTo)}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-sub">Opened</dt>
              <dd title={formatInstant(row.createdAt)}>{formatDay(row.createdAt)}</dd>
            </div>
            <div className="flex min-w-0 items-center gap-1">
              <dt className="whitespace-nowrap text-sub">Case ID</dt>
              <dd className="flex min-w-0 items-center">
                <code className="truncate font-mono text-xs">{row.id}</code>
                <CopyButton value={row.id} label="Copy case ID" />
              </dd>
            </div>
          </dl>
        </div>
        <CaseActions row={row} selfId={self.id} />
      </div>
      {row.status === "resolved" && row.resolution && (
        <section className="mb-4 rounded-panel border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          <h2 className="text-sm font-semibold">Resolution</h2>
          <p className="mt-1 text-sm break-words whitespace-pre-wrap">{row.resolution}</p>
        </section>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-4">
          <section className="rounded-panel border border-line bg-panel p-4">
            <NoteBox path={`/admin/support/cases/${encodeURIComponent(row.id)}/notes`} />
          </section>
          <Panel title="Timeline">
            <CaseTimeline
              notes={data.notes}
              timeline={data.timeline}
              people={[
                { id: self.id, name: self.name, email: self.email },
                ...(row.assignedTo ? [row.assignedTo] : []),
              ]}
            />
          </Panel>
        </div>
        <Panel title="Account facts">
          <CaseDiagnostics accountId={row.accountId} diagnostics={data.diagnostics} />
        </Panel>
      </div>
      <div className="mt-4">
        <UpdatedAt iso={data.generatedAt} cached={false} />
      </div>
    </>
  );
}

export default function CasePage(props: PageProps<"/admin/support/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton label="Loading case" />}>
      <CaseDetail {...props} />
    </Suspense>
  );
}
