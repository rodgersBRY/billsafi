import type { AdminUserSession } from "@billsafi/contracts";
import { Monitor } from "lucide-react";
import { formatInstant, formatRelative } from "../admin-format";
import { EmptyState } from "../admin-ui";
import { type Column, DataTable, tdClass } from "../data-table";

const columns: Column[] = [
  { label: "Device" },
  { label: "Signed in" },
  { label: "Last seen" },
  { label: "Expires" },
  { label: "IP address" },
];

/** The 10 most recently used sessions. Addresses are cut short to keep personal data down. */
export function UserSessions({ sessions }: { sessions: AdminUserSession[] }) {
  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={Monitor}
        title="No active sessions"
        description="This user is signed out everywhere."
      />
    );
  }
  return (
    <DataTable caption="Sessions" columns={columns}>
      {sessions.map((session) => (
        <tr key={`${session.createdAt}-${session.expiresAt}`} className="border-t border-line">
          <td className={`${tdClass} whitespace-nowrap`}>
            {session.device.browser} on {session.device.os}
          </td>
          <td className={`${tdClass} whitespace-nowrap text-sub`}>
            {formatInstant(session.createdAt)}
          </td>
          <td className={`${tdClass} whitespace-nowrap`}>
            <time dateTime={session.updatedAt} title={formatInstant(session.updatedAt)}>
              {formatRelative(session.updatedAt)}
            </time>
          </td>
          <td className={`${tdClass} whitespace-nowrap text-sub`}>
            {formatInstant(session.expiresAt)}
          </td>
          <td className={`${tdClass} font-mono text-xs whitespace-nowrap`}>
            {session.ipAddress ?? "Unknown"}
          </td>
        </tr>
      ))}
    </DataTable>
  );
}
