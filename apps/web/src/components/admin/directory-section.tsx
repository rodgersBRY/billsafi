import { SearchX } from "lucide-react";
import Link from "next/link";
import { EmptyState, PastEndState, UpdatedAt } from "./admin-ui";
import { Pagination } from "./data-table";
import { FilterBar } from "./filter-bar";
import type { FilterField } from "./filter-fields";

interface DirectorySectionProps {
  label: string;
  fields: FilterField[];
  page: { page: number; pageSize: number; total: number; generatedAt: string };
  rows: number;
  /** Whether any filter is set, to tell "no matches" from "nothing yet". */
  filtered: boolean;
  /** The list with its filters cleared. */
  clearHref: string;
  pageHref: (page: number) => string;
  empty: { title: string; description?: string };
  children: React.ReactNode;
}

/** Filters, a list, its empty and past-the-end states, and paging, as one panel. */
export function DirectorySection(props: DirectorySectionProps) {
  const { page, rows, filtered } = props;
  return (
    <div className="space-y-3">
      <section className="min-w-0 rounded-panel border border-line bg-panel">
        <FilterBar label={props.label} fields={props.fields} />
        {rows === 0 && page.total > 0 ? (
          <PastEndState firstPageHref={props.pageHref(1)} />
        ) : rows === 0 && filtered ? (
          <EmptyState
            icon={SearchX}
            title="Nothing matches these filters"
            description="Try a shorter search or clear a filter."
            action={
              <Link href={props.clearHref} className="text-sm text-accent hover:underline">
                Clear filters
              </Link>
            }
          />
        ) : rows === 0 ? (
          <EmptyState title={props.empty.title} description={props.empty.description} />
        ) : (
          props.children
        )}
        <Pagination
          page={page.page}
          pageSize={page.pageSize}
          total={page.total}
          href={props.pageHref}
        />
      </section>
      <UpdatedAt iso={page.generatedAt} />
    </div>
  );
}
