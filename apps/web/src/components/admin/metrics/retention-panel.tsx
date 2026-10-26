import { Fragment } from "react";
import type { AdminRetention } from "@billsafi/contracts";
import { formatDate } from "@/lib/format";
import { formatCount, formatShare } from "../admin-format";
import { EmptyRow, Panel, UpdatedAt } from "../admin-ui";
import { DataTable } from "../charts/chart-card";

/*
 * The accent colour at a strength that follows the share. A 10% floor keeps
 * small shares visible, and the top stops where the cell text would drop below
 * 4.5:1 contrast: 60% in light mode, 40% in dark mode, where the accent is pale.
 */
const shadeClass = "[--shade-span:50%] dark:[--shade-span:30%]";

function shade(share: number): React.CSSProperties | undefined {
  const clamped = Math.min(Math.max(share, 0), 1);
  if (clamped === 0) return undefined;
  return {
    backgroundColor: `color-mix(in srgb, var(--accent) calc(10% + var(--shade-span) * ${clamped}), transparent)`,
  };
}

export function RetentionPanel({ data }: { data: AdminRetention }) {
  const columns = Math.max(0, ...data.cohorts.map((cohort) => cohort.activeShare.length));

  return (
    <section aria-labelledby="retention-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="retention-title" className="text-lg font-semibold">
            Retention
          </h2>
          <p className="text-sm text-sub">
            Share of each sign-up week with an invoice made Ready in the weeks after.
          </p>
        </div>
      </div>
      <Panel
        title="Weekly cohorts"
        description="Weeks start on Monday, Nairobi time. Week 0 is the sign-up week. Darker cells mean a larger share."
      >
        {data.cohorts.length === 0 ? (
          <EmptyRow text="No sign-ups in this period." />
        ) : (
          <>
            <div
              role="img"
              aria-label="Retention heatmap. Each row is a sign-up week and each cell the share of its users with an invoice made Ready that many weeks later. The figures are in the table below."
              className="overflow-x-auto"
            >
              <div
                aria-hidden
                className="grid w-max gap-0.5 text-xs"
                style={{
                  gridTemplateColumns: `6.5rem 3rem repeat(${columns}, 3.25rem)`,
                }}
              >
                <span className="px-1 pb-1 text-sub">Sign-up week</span>
                <span className="px-1 pb-1 text-right text-sub">Users</span>
                {Array.from({ length: columns }, (_, week) => (
                  <span key={week} className="pb-1 text-center whitespace-nowrap text-sub">
                    Wk {week}
                  </span>
                ))}
                {data.cohorts.map((cohort) => (
                  <Fragment key={cohort.weekStart}>
                    <span className="flex items-center px-1 whitespace-nowrap">
                      {formatDate(cohort.weekStart)}
                    </span>
                    <span className="flex items-center justify-end px-1 tabular-nums">
                      {formatCount(cohort.users)}
                    </span>
                    {Array.from({ length: columns }, (_, week) => {
                      const share = cohort.activeShare[week];
                      return share === undefined || share === null ? (
                        <span
                          key={week}
                          className="h-8 rounded-sm border border-dashed border-line"
                        />
                      ) : (
                        <span
                          key={week}
                          className={`${shadeClass} flex h-8 items-center justify-center rounded-sm border border-line text-ink tabular-nums`}
                          style={shade(share)}
                        >
                          {formatShare(share)}
                        </span>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
            <DataTable
              title="Weekly cohorts"
              table={{
                columns: [
                  "Sign-up week",
                  "Users",
                  ...Array.from({ length: columns }, (_, week) => `Week ${week}`),
                ],
                rows: data.cohorts.map((cohort) => [
                  formatDate(cohort.weekStart),
                  formatCount(cohort.users),
                  ...Array.from({ length: columns }, (_, week) => {
                    const share = cohort.activeShare[week];
                    return share === undefined || share === null ? "" : formatShare(share);
                  }),
                ]),
              }}
            />
          </>
        )}
      </Panel>
      <UpdatedAt iso={data.generatedAt} />
    </section>
  );
}
