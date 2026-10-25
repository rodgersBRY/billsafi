import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatCount } from "./admin-format";
import { ScrollArea } from "./scroll-area";

export const thClass = "px-4 py-3 font-medium whitespace-nowrap";
export const tdClass = "px-4 py-3 align-top";

export interface Column {
  label: string;
  /** The API sort key, for sortable columns. */
  sort?: string;
  align?: "right";
  /** Hide the visible text, for an actions column. */
  srOnly?: boolean;
  /** The direction of the first click; newest or largest first unless set. */
  firstDir?: "asc" | "desc";
}

type Dir = "asc" | "desc";

interface DataTableProps {
  caption: string;
  columns: Column[];
  sort?: { sort: string; dir: Dir };
  /** Link for sorting by a column in a direction; required with sortable columns. */
  sortHref?: (sort: string, dir: Dir) => string;
  /** A card list shown instead of the table below 768px. */
  mobile?: React.ReactNode;
  children: React.ReactNode;
}

function SortHeader({ column, props }: { column: Column; props: DataTableProps }) {
  const active = props.sort?.sort === column.sort;
  const dir = active ? props.sort!.dir : undefined;
  const next: Dir = active ? (dir === "desc" ? "asc" : "desc") : (column.firstDir ?? "desc");
  const Icon = dir === "asc" ? ArrowUp : dir === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <Link
      href={props.sortHref!(column.sort!, next)}
      replace
      scroll={false}
      className="-mx-1 inline-flex items-center gap-1 rounded-sm px-1 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
    >
      {column.label}
      <Icon aria-hidden className={`size-3.5 ${active ? "text-ink" : "opacity-60"}`} />
      <span className="sr-only">
        {active ? `, sorted ${dir === "asc" ? "ascending" : "descending"}. ` : ". "}
        Sort {next === "asc" ? "ascending" : "descending"}
      </span>
    </Link>
  );
}

/** A semantic table with server-side sorting through the URL. */
export function DataTable(props: DataTableProps) {
  const { caption, columns, sort, mobile, children } = props;
  const table = (
    <ScrollArea label={caption}>
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-background text-left text-xs text-sub">
          <tr>
            {columns.map((column) => {
              const sorted = column.sort && sort?.sort === column.sort;
              return (
                <th
                  key={column.label}
                  scope="col"
                  aria-sort={
                    column.sort
                      ? sorted
                        ? sort!.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                  className={`${thClass} ${column.align === "right" ? "text-right" : ""}`}
                >
                  {column.srOnly ? (
                    <span className="sr-only">{column.label}</span>
                  ) : column.sort && props.sortHref ? (
                    <SortHeader column={column} props={props} />
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </ScrollArea>
  );
  if (!mobile) return table;
  return (
    <>
      <div className="hidden md:block">{table}</div>
      <div className="md:hidden">{mobile}</div>
    </>
  );
}

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  href: (page: number) => string;
}

const pagerLink =
  "inline-flex min-h-11 items-center gap-1 rounded-panel border border-line bg-panel px-3 text-sm md:min-h-9";

/** "Showing 1-25 of 248" with Previous and Next. */
export function Pagination({ page, pageSize, total, href }: PaginationProps) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const hasPrev = page > 1;
  const hasNext = end < total;
  return (
    <nav
      aria-label="Pages"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3"
    >
      <p className="text-sm text-sub">
        {total === 0
          ? "No results"
          : `Showing ${formatCount(start)}-${formatCount(end)} of ${formatCount(total)}`}
      </p>
      <div className="flex gap-2">
        {hasPrev ? (
          <Link href={href(page - 1)} className={`${pagerLink} hover:bg-soft`}>
            <ChevronLeft aria-hidden className="size-4" />
            Previous
          </Link>
        ) : (
          <span aria-disabled="true" className={`${pagerLink} text-sub opacity-60`}>
            <ChevronLeft aria-hidden className="size-4" />
            Previous
          </span>
        )}
        {hasNext ? (
          <Link href={href(page + 1)} className={`${pagerLink} hover:bg-soft`}>
            Next
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        ) : (
          <span aria-disabled="true" className={`${pagerLink} text-sub opacity-60`}>
            Next
            <ChevronRight aria-hidden className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
