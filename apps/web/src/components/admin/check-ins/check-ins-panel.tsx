import { type AdminCheckIns, reengagementSegments } from "@billsafi/contracts";
import { MailX } from "lucide-react";
import { formatCount, formatShare } from "../admin-format";
import { EmptyState, Panel } from "../admin-ui";
import { InfoPopover } from "../info-popover";
import { KpiCard } from "../kpi-card";
import { tdClass, thClass, theadClass } from "../table-classes";
import { segmentLabels, stepLabel } from "./check-in-labels";

/** Check-in emails sent in the range and how many brought the account back (D069). */
export function CheckInsPanel({ data }: { data: AdminCheckIns }) {
  const { totals, returnWindowDays } = data;
  const nothingSent = totals.sent === 0;
  return (
    <section aria-labelledby="check-ins-title" className="space-y-4">
      <div>
        <h2 id="check-ins-title" className="flex items-center gap-1.5 text-lg font-semibold">
          Check-in emails
          <InfoPopover label="About check-in emails">
            <p>
              Up to three emails to accounts that went quiet. An email counts as bringing the
              account back when the owner signs in, adds a business or does something within{" "}
              {returnWindowDays} days of it.
            </p>
          </InfoPopover>
        </h2>
        <p className="text-sm text-sub">
          {data.enabled
            ? `On, up to ${formatCount(data.dailyLimit)} a day.`
            : "Switched off in this environment."}
        </p>
      </div>

      {nothingSent ? (
        <Panel title="Sent in this range">
          <EmptyState
            icon={MailX}
            title="No check-in emails in this range"
            description={
              data.enabled
                ? "Emails go out between 09:00 and 17:00 Nairobi time."
                : "Set REENGAGEMENT_JOBS=on to start sending."
            }
          />
        </Panel>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <li>
              <KpiCard
                label="Sent"
                value={formatCount(totals.sent)}
                detail={`To ${formatCount(totals.accounts)} accounts`}
                definition="Check-in emails sent in the range."
              />
            </li>
            <li>
              <KpiCard
                label="Came back"
                value={formatShare(totals.returnRate)}
                detail={`${formatCount(totals.returned)} of ${formatCount(totals.sent)} emails`}
                definition={`Followed by a sign-in or action within ${returnWindowDays} days.`}
              />
            </li>
            <li>
              <KpiCard
                label="Still open"
                value={formatCount(totals.stillOpen)}
                definition={`Sent under ${returnWindowDays} days ago; may still bring someone back.`}
              />
            </li>
            <li>
              <KpiCard
                label="Unsubscribed"
                value={formatCount(totals.unsubscribed)}
                definition="Accounts that opted out in the range."
              />
            </li>
          </ul>
          <Panel title="By email">
            <table className="w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th scope="col" className={thClass}>
                    Group
                  </th>
                  <th scope="col" className={thClass}>
                    Email
                  </th>
                  <th scope="col" className={`${thClass} text-right`}>
                    Sent
                  </th>
                  <th scope="col" className={`${thClass} text-right`}>
                    Came back
                  </th>
                </tr>
              </thead>
              {reengagementSegments.map((segment) => (
                <tbody key={segment} className="border-t border-line">
                  {data.steps
                    .filter((row) => row.segment === segment)
                    .map((row, index) => (
                      <tr key={row.step} className={index > 0 ? "border-t border-line" : ""}>
                        {index === 0 && (
                          <th
                            scope="rowgroup"
                            rowSpan={3}
                            className={`${tdClass} text-left font-medium`}
                          >
                            {segmentLabels[segment]}
                          </th>
                        )}
                        <td className={tdClass}>{stepLabel(row.step)}</td>
                        <td className={`${tdClass} text-right tabular-nums`}>
                          {formatCount(row.sent)}
                        </td>
                        <td className={`${tdClass} text-right tabular-nums`}>
                          {row.sent === 0
                            ? "None sent"
                            : `${formatShare(row.returnRate)} (${formatCount(row.returned)})`}
                        </td>
                      </tr>
                    ))}
                </tbody>
              ))}
            </table>
          </Panel>
        </>
      )}
    </section>
  );
}
