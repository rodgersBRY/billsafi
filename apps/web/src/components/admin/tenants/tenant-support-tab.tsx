import type { AdminTenantDetail } from "@billsafi/contracts";
import { LifeBuoy, StickyNote } from "lucide-react";
import { getAdminSupportAccount } from "@/lib/server-api/admin";
import { formatInstant, formatRelative } from "../admin-format";
import { EmptyState, Panel } from "../admin-ui";
import { CaseTable } from "../support/case-table";
import { NewCaseButton } from "../support/new-case-dialog";
import { NoteBox } from "../support/note-box";

/** The account's support cases and loose notes, with New case and Add note. */
export async function TenantSupportTab({
  data,
  selfId,
}: {
  data: AdminTenantDetail;
  selfId: string;
}) {
  const { tenant } = data;
  const support = await getAdminSupportAccount(tenant.id);
  return (
    <div className="space-y-4">
      <Panel
        title="Cases"
        actions={
          <NewCaseButton
            selfId={selfId}
            variant="secondary"
            account={{ id: tenant.id, name: tenant.owner.name, email: tenant.owner.email }}
          />
        }
      >
        {support.cases.length === 0 ? (
          <EmptyState icon={LifeBuoy} title="No cases for this account" />
        ) : (
          <CaseTable cases={support.cases} caption="Account cases" showAccount={false} />
        )}
      </Panel>
      <Panel title="Notes" description="Internal. The account owner never sees them.">
        <div className="p-4">
          <NoteBox
            path={`/admin/support/accounts/${encodeURIComponent(tenant.id)}/notes`}
            label="Add a note about this account"
          />
        </div>
        {support.notes.length === 0 ? (
          <div className="border-t border-line">
            <EmptyState icon={StickyNote} title="No loose notes" />
          </div>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {support.notes.map((note) => (
              <li key={note.id} className="px-4 py-3">
                <p className="text-sm font-medium">
                  {note.author?.name || note.author?.email || "A removed user"}
                </p>
                <p className="mt-1 text-sm break-words whitespace-pre-wrap">{note.body}</p>
                <p className="mt-1 text-xs text-sub">
                  <time dateTime={note.createdAt} title={formatInstant(note.createdAt)}>
                    {formatRelative(note.createdAt)}
                  </time>
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
