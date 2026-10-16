import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { getSessionUser, listBusinesses } from "@/lib/api.server";
import { FreshOnNavigation } from "./fresh-on-navigation";
import { OnboardingWizard } from "./onboarding-wizard";

export const metadata: Metadata = { title: "Set up your business · TallyNest" };

async function Wizard() {
  const [user, businesses] = await Promise.all([getSessionUser(), listBusinesses()]);
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
