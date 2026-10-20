import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { type SettingsTab, settingsTabs } from "@/components/settings/settings-tabs";
import { SettingsView } from "@/components/settings/settings-view";
import { getSessionUser } from "@/lib/server-api/auth";
import { getBusiness, listPaymentInstructions } from "@/lib/server-api/businesses";

export const metadata: Metadata = { title: "Settings · Billsafi" };

async function Settings({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ businessId }, { tab }] = await Promise.all([params, searchParams]);
  const [business, instructions, user] = await Promise.all([
    getBusiness(businessId),
    listPaymentInstructions(businessId),
    getSessionUser(),
  ]);
  const initialTab = settingsTabs.some((item) => item.id === tab)
    ? (tab as SettingsTab)
    : "profile";
  return (
    <SettingsView
      business={business}
      paymentInstruction={instructions.at(-1) ?? null}
      user={user}
      initialTab={initialTab}
    />
  );
}

export default function SettingsPage({
  params,
  searchParams,
}: PageProps<"/[businessId]/settings">) {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-16">
          <BrandLoader />
        </div>
      }
    >
      <Settings params={params} searchParams={searchParams as Promise<{ tab?: string }>} />
    </Suspense>
  );
}
