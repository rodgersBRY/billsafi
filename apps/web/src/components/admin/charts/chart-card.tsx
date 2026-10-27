import { InfoPopover } from "../info-popover";

export interface ChartTable {
  columns: string[];
  rows: string[][];
}

interface ChartCardProps {
  title: string;
  /** One sentence saying what the chart shows; it sits behind the info button. */
  summary: string;
  /** Replaces the plot when there is nothing to draw. */
  emptyText?: string;
  table: ChartTable;
  children: React.ReactNode;
}

/** Title, summary, legend, plot and a "Show data" table: the frame every chart sits in. */
export function ChartCard({ title, summary, emptyText, table, children }: ChartCardProps) {
  return (
    <section className="min-w-0 rounded-panel border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <InfoPopover label={`What does ${title} show?`}>{summary}</InfoPopover>
      </div>
      <div className="mt-3">
        {emptyText ? (
          <p className="rounded-panel border border-dashed border-line px-4 py-8 text-center text-sm text-sub">
            {emptyText}
          </p>
        ) : (
          children
        )}
      </div>
      <DataTable title={title} table={table} />
    </section>
  );
}

/** The same figures as text, closed by default. It is also how a screen reader reads the chart. */
export function DataTable({ title, table }: { title: string; table: ChartTable }) {
  return (
    <details className="group mt-3 border-t border-line pt-1">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:min-h-9">
        <span className="group-open:hidden">Show data</span>
        <span className="hidden group-open:inline">Hide data</span>
      </summary>
      <div className="max-h-72 overflow-auto rounded-panel border border-line">
        <table className="w-full text-sm">
          <caption className="sr-only">{title}</caption>
          <thead className="sticky top-0 bg-background text-left text-xs text-sub">
            <tr>
              {table.columns.map((column, index) => (
                <th
                  key={column}
                  scope="col"
                  className={`px-3 py-2 font-medium whitespace-nowrap ${index > 0 ? "text-right" : ""}`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row[0]} className="border-t border-line">
                {row.map((cell, index) =>
                  index === 0 ? (
                    <th
                      key={index}
                      scope="row"
                      className="px-3 py-2 text-left font-normal whitespace-nowrap"
                    >
                      {cell}
                    </th>
                  ) : (
                    <td key={index} className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
