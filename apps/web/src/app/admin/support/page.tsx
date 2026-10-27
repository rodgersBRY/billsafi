import { Suspense } from "react";
import { AccessGate } from "@/components/admin/access-gate";
import { adminMetadata } from "@/components/admin/admin-metadata";
import {
  hrefWith,
  parseSupportParams,
  supportDefaults,
  supportHref,
  toQuery,
} from "@/components/admin/admin-params";
import { DirectorySection } from "@/components/admin/directory-section";
import { PageHeader } from "@/components/admin/page-header";
import { TableSkeleton } from "@/components/admin/page-skeleton";
import { CaseTable } from "@/components/admin/support/case-table";
import { NewCaseButton } from "@/components/admin/support/new-case-dialog";
import { supportFilters } from "@/components/admin/support/support-filters";
import { SupportTabs } from "@/components/admin/support/support-tabs";
import { getAdminSelf, getAdminSupportCases } from "@/lib/server-api/admin";

export const generateMetadata = () => adminMetadata("Support");

const emptyText = {
  open: "No open cases",
  waiting: "No cases are waiting",
  recent: "Nothing updated in the last 7 days",
  resolved: "No resolved cases yet",
} as const;

async function Cases({ searchParams }: PageProps<"/admin/support">) {
  const state = parseSupportParams(await searchParams);
  const [data, self] = await Promise.all([
    getAdminSupportCases(toQuery(state, { ...supportDefaults, tab: undefined })),
    getAdminSelf(),
  ]);
  const href = (changes: Record<string, string | number | undefined>) =>
    hrefWith("/admin/support", state, changes, supportDefaults);
  const filtered =
    toQuery({ ...state, page: undefined, sort: undefined, dir: undefined, tab: undefined }) !== "";
  return (
    <>
      <PageHeader
        title="Support"
        description="Cases and internal notes."
        actions={<NewCaseButton selfId={self.id} />}
      />
      <SupportTabs state={state} />
      <DirectorySection
        label="Filter cases"
        fields={supportFilters}
        page={data}
        rows={data.cases.length}
        filtered={filtered}
        clearHref={supportHref({ tab: state.tab })}
        pageHref={(page) => href({ page })}
        empty={{ title: emptyText[state.tab] }}
      >
        <CaseTable
          cases={data.cases}
          sort={{ sort: state.sort, dir: state.dir }}
          sortHref={(sort, dir) => href({ sort, dir, page: 1 })}
        />
      </DirectorySection>
    </>
  );
}

export default function SupportPage(props: PageProps<"/admin/support">) {
  return (
    <Suspense fallback={<TableSkeleton label="Loading cases" />}>
      <AccessGate>
        <Cases {...props} />
      </AccessGate>
    </Suspense>
  );
}
