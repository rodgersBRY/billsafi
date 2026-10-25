import { type AdminRetention, adminRetentionWeeks } from "@billsafi/contracts";
import { formatDate } from "@/lib/format";
import { formatCount, formatShare } from "../admin-format";
import {
  EmptyRow,
  Panel,
  PeriodSwitch,
  UpdatedAt,
  tdClass,
  thClass,
  theadClass,
} from "../admin-ui";

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

interface RetentionPanelProps {
  data: AdminRetention;
  /** Link to the same page with another number of cohorts. */
  hrefFor: (weeks: (typeof adminRetentionWeeks)[number]) => string;
}

export function RetentionPanel({ data, hrefFor }: RetentionPanelProps) {
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
        <PeriodSwitch
          label="Cohorts shown"
          options={adminRetentionWeeks.map((weeks) => ({
            label: `${weeks} weeks`,
            href: hrefFor(weeks),
            current: weeks === data.weeks,
          }))}
        />
      </div>
      <Panel
        title="Weekly cohorts"
        description="Weeks start on Monday, Nairobi time. Week 0 is the sign-up week."
      >
        {data.cohorts.length === 0 ? (
          <EmptyRow text="No sign-ups in this period." />
        ) : (
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr>
                <th scope="col" className={thClass}>
                  Sign-up week
                </th>
                <th scope="col" className={`${thClass} text-right`}>
                  Users
                </th>
                {Array.from({ length: columns }, (_, week) => (
                  <th key={week} scope="col" className={`${thClass} text-center`}>
                    Week {week}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.cohorts.map((cohort) => (
                <tr key={cohort.weekStart} className="border-t border-line">
                  <th scope="row" className={`${tdClass} text-left font-normal`}>
                    {formatDate(cohort.weekStart)}
                  </th>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {formatCount(cohort.users)}
                  </td>
                  {Array.from({ length: columns }, (_, week) => {
                    const share = cohort.activeShare[week];
                    return share === undefined || share === null ? (
                      <td key={week} className={tdClass} />
                    ) : (
                      <td
                        key={week}
                        className={`${tdClass} ${shadeClass} text-center tabular-nums`}
                        style={shade(share)}
                      >
                        {formatShare(share)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <UpdatedAt iso={data.generatedAt} />
    </section>
  );
}
