import { type AdminRetention, adminRetentionWeeks } from "@billsafi/contracts";
import { formatDate } from "@/lib/format";
import { formatCount, formatShare } from "./admin-format";
import { type AdminState, adminHref } from "./admin-params";
import { EmptyRow, Panel, PeriodSwitch, UpdatedAt, tdClass, thClass, theadClass } from "./admin-ui";

/** The accent colour at an opacity that follows the share, readable in both themes. */
function shade(share: number): React.CSSProperties {
  const clamped = Math.min(Math.max(share, 0), 1);
  // A faint floor keeps small shares visible; zero stays unshaded.
  const strength = clamped === 0 ? 0 : Math.round(10 + clamped * 50);
  return { backgroundColor: `color-mix(in srgb, var(--accent) ${strength}%, transparent)` };
}

export function RetentionTab({ data, state }: { data: AdminRetention; state: AdminState }) {
  const columns = Math.max(0, ...data.cohorts.map((cohort) => cohort.activeShare.length));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-sub">
          Share of each sign-up week with an invoice made Ready in the weeks after.
        </p>
        <PeriodSwitch
          label="Cohorts shown"
          options={adminRetentionWeeks.map((weeks) => ({
            label: `${weeks} weeks`,
            href: adminHref(state, { weeks }),
            current: weeks === data.weeks,
          }))}
        />
      </div>
      <Panel
        title="Weekly retention"
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
                        className={`${tdClass} text-center tabular-nums`}
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
    </div>
  );
}
