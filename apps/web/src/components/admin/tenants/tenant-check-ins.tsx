import type { AdminTenantCheckIns } from "@billsafi/contracts";
import { formatDay } from "../admin-format";
import { EmptyRow, Panel } from "../admin-ui";
import { segmentLabels, stepLabel } from "../check-ins/check-in-labels";

/** The check-in emails this account got and whether it opted out (D069). */
export function TenantCheckIns({ data }: { data: AdminTenantCheckIns }) {
  const status = data.optedOutAt
    ? `Unsubscribed on ${formatDay(data.optedOutAt)}.`
    : "Subscribed. Gets check-in emails if the account goes quiet.";
  return (
    <Panel title="Check-in emails" description={status}>
      {data.emails.length === 0 ? (
        <EmptyRow text="None sent." />
      ) : (
        <ul className="divide-y divide-line">
          {data.emails.map((email) => (
            <li
              key={`${email.sentAt}-${email.step}`}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm"
            >
              <span>
                {segmentLabels[email.segment]}, {stepLabel(email.step).toLowerCase()}
              </span>
              <span className="text-sub tabular-nums">{formatDay(email.sentAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
