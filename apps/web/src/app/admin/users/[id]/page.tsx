import { notFound } from "next/navigation";
import { Suspense } from "react";
import { adminMetadata } from "@/components/admin/admin-metadata";
import { Panel, UpdatedAt } from "@/components/admin/admin-ui";
import { AuditTimeline } from "@/components/admin/audit/audit-timeline";
import { PageSkeleton } from "@/components/admin/page-skeleton";
import { roleLabels } from "@/components/admin/status-badge";
import { UserHeader } from "@/components/admin/users/user-header";
import { UserSessions } from "@/components/admin/users/user-sessions";
import { methodsText } from "@/components/admin/users/user-text";
import { getAdminAccess, getAdminSelf, getAdminUser } from "@/lib/server-api/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadUser(params: Promise<{ id: string }>) {
  const { id } = await params;
  await getAdminAccess();
  if (!UUID.test(id)) notFound();
  return getAdminUser(id);
}

export async function generateMetadata({ params }: PageProps<"/admin/users/[id]">) {
  const data = await loadUser(params);
  return adminMetadata(`${data.user.name} · Users`);
}

async function UserDetail({ params }: PageProps<"/admin/users/[id]">) {
  const [data, self] = await Promise.all([loadUser(params), getAdminSelf()]);
  const { user } = data;
  const identity: [string, string][] = [
    ["Email verified", user.emailVerified ? "Yes" : "No"],
    ["Sign-in methods", methodsText(user.signInMethods)],
    ["Platform role", roleLabels[user.role]],
  ];

  return (
    <>
      <UserHeader user={user} selfId={self.id} />
      <div className="space-y-4">
        <Panel title="Identity and access">
          <dl className="divide-y divide-line">
            {identity.map(([label, value]) => (
              <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm text-sub">{label}</dt>
                <dd className="text-sm sm:col-span-2">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-line px-4 py-3 text-xs text-sub">
            Roles are set by the server configuration (ADMIN_USER_IDS) and can&apos;t be changed
            here.
          </p>
        </Panel>
        <Panel
          title="Sessions"
          description="The 10 most recently used. IP addresses are shortened."
        >
          <UserSessions sessions={data.sessions} />
        </Panel>
        <Panel
          title="Recent admin actions"
          description="The 20 latest about this user or their account."
        >
          <AuditTimeline entries={data.recentAudit} targetId={user.id} />
        </Panel>
        <UpdatedAt iso={data.generatedAt} cached={false} />
      </div>
    </>
  );
}

export default function UserPage(props: PageProps<"/admin/users/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton label="Loading user" />}>
      <UserDetail {...props} />
    </Suspense>
  );
}
