import type { AdminSetting } from "@billsafi/contracts";
import { CircleCheck, CircleX } from "lucide-react";
import { formatInstant, formatRelative } from "../admin-format";
import { AnnouncementBanner } from "@/components/announcement/announcement-banner";
import { SettingEditor } from "./settings-editor";

function Facts({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="space-y-2">
      {items.map(([label, value]) => (
        <div key={label} className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-3">
          <dt className="text-sm text-sub">{label}</dt>
          <dd className="min-w-0 text-sm break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function windowText(setting: AdminSetting<"announcement">) {
  const { startsAt, endsAt } = setting.value;
  if (!startsAt && !endsAt) return "Always, while on";
  return `${startsAt ? formatInstant(startsAt) : "Now"} - ${endsAt ? formatInstant(endsAt) : "No end"}`;
}

function Value({ setting }: { setting: AdminSetting }) {
  switch (setting.key) {
    case "registration": {
      const { open, closedMessage } = setting.value;
      return (
        <div className="space-y-2">
          <p
            className={`flex items-center gap-2 text-lg font-semibold ${open ? "" : "text-red-700 dark:text-red-300"}`}
          >
            {open ? (
              <CircleCheck aria-hidden className="size-5 text-accent" />
            ) : (
              <CircleX aria-hidden className="size-5" />
            )}
            {open ? "Open" : "Closed"}
          </p>
          <Facts items={[["Closed message", closedMessage]]} />
        </div>
      );
    }
    case "announcement": {
      const { active, tone, message, linkUrl } = setting.value;
      return (
        <div className="space-y-3">
          <p className="text-lg font-semibold">{active ? "On" : "Off"}</p>
          {message && (
            <AnnouncementBanner preview tone={tone} message={message} linkUrl={linkUrl ?? null} />
          )}
          <Facts items={[["Shown", windowText(setting)]]} />
        </div>
      );
    }
    case "support_contact": {
      const { email, whatsapp, hours } = setting.value;
      return (
        <Facts
          items={[
            [
              "Email",
              <span key="e" className="break-all">
                {email}
              </span>,
            ],
            ["WhatsApp", whatsapp ?? <span className="text-sub">Not set</span>],
            ["Hours", hours ?? <span className="text-sub">Not set</span>],
          ]}
        />
      );
    }
  }
}

/** One card per setting: its value, whether it is the default, and who changed it last. */
export function SettingCard({ setting }: { setting: AdminSetting }) {
  return (
    <section
      aria-labelledby={`setting-${setting.key}`}
      className="min-w-0 rounded-panel border border-line bg-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id={`setting-${setting.key}`} className="text-base font-semibold">
            {setting.label}
          </h2>
          {setting.isDefault && (
            <span className="rounded-md border border-line bg-background px-1.5 py-0.5 text-xs text-sub">
              Default
            </span>
          )}
        </div>
        <SettingEditor setting={setting} />
      </div>
      <div className="border-t border-line px-4 py-4">
        <Value setting={setting} />
      </div>
      <p className="border-t border-line px-4 py-3 text-xs text-sub">
        {setting.updatedAt ? (
          <>
            Changed by{" "}
            {setting.updatedBy
              ? setting.updatedBy.name || setting.updatedBy.email
              : "a removed user"}{" "}
            <time dateTime={setting.updatedAt} title={formatInstant(setting.updatedAt)}>
              {formatRelative(setting.updatedAt)}
            </time>
          </>
        ) : (
          "Never changed"
        )}
      </p>
    </section>
  );
}
