"use client";

import type { Business, PaymentInstruction } from "@tallynest/contracts";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AccountSettings } from "./account-settings";
import { DefaultsSettings } from "./defaults-settings";
import { PaymentSettings } from "./payment-settings";
import { ProfileSettings } from "./profile-settings";
import { type SettingsTab, settingsTabs } from "./settings-tabs";

interface SettingsViewProps {
  business: Business;
  paymentInstruction: PaymentInstruction | null;
  user: { name: string; email: string };
  initialTab: SettingsTab;
}

/** Approved business settings (D037) plus the account tab (D052). Billing stays separate. */
export function SettingsView({
  business,
  paymentInstruction,
  user,
  initialTab,
}: SettingsViewProps) {
  const router = useRouter();
  const [tab, setTab] = useState<SettingsTab>(initialTab);

  function select(next: SettingsTab) {
    setTab(next);
    router.replace(`?tab=${next}`, { scroll: false });
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = settingsTabs[(index + step + settingsTabs.length) % settingsTabs.length]!;
    select(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  }

  return (
    <div className="mx-auto max-w-200">
      <div className="mb-6.25">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1.25 text-sm text-sub">
          {tab === "account"
            ? "Your sign-in details. They apply to every business."
            : `Manage how ${business.displayName} appears to your clients.`}
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Settings sections"
        className="mb-4.5 flex gap-1 overflow-x-auto border-b border-line"
      >
        {settingsTabs.map((item, index) => (
          <button
            key={item.id}
            id={`tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => select(item.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className="-mb-px shrink-0 border-b-2 border-transparent px-3 py-2.5 text-sm text-sub hover:text-ink aria-selected:border-accent aria-selected:text-accent"
          >
            {item.label}
          </button>
        ))}
      </div>

      <section
        id={`panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="rounded-panel border border-line bg-panel p-5 sm:p-6"
      >
        {tab === "profile" && <ProfileSettings business={business} />}
        {tab === "payment" && (
          <PaymentSettings businessId={business.id} current={paymentInstruction} />
        )}
        {tab === "defaults" && <DefaultsSettings business={business} />}
        {tab === "account" && <AccountSettings user={user} />}
      </section>
    </div>
  );
}
