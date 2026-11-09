import { canAddBusiness } from "@billsafi/domain";
import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { getSessionUser } from "@/lib/server-api/auth";
import { getUsage } from "@/lib/server-api/billing";
import { listBusinesses } from "@/lib/server-api/businesses";
import { BusinessLimitNotice } from "./business-limit-notice";
import { FreshOnNavigation } from "./fresh-on-navigation";
import { OnboardingWizard } from "./onboarding-wizard";

export const metadata: Metadata = { title: "Set up your business · BillSafi" };

async function Wizard() {
  const [user, businesses, usage] = await Promise.all([
    getSessionUser(),
    listBusinesses(),
    getUsage(),
  ]);
  if (!canAddBusiness(usage.plan === "pro", businesses.length)) return <BusinessLimitNotice />;
  return (
    <FreshOnNavigation>
      <OnboardingWizard
        user={{ name: user.name, email: user.email }}
        isAdditionalBusiness={businesses.length > 0}
      />
    </FreshOnNavigation>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="col-span-full grid place-items-center py-16">
          <BrandLoader />
        </div>
      }
    >
      <Wizard />
    </Suspense>
  );
}
