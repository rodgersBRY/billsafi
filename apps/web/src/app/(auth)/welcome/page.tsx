import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/brand-loader";
import { WelcomeScreen } from "@/components/auth/welcome-screen";
import { getSessionUser } from "@/lib/server-api/auth";
import { safeNextPath } from "@/lib/welcome";

export const metadata: Metadata = { title: "Welcome · BillSafi" };

async function Welcome({ searchParams }: PageProps<"/welcome">) {
  const [query, user] = await Promise.all([searchParams, getSessionUser()]);
  const firstName = user.name.trim().split(/\s+/)[0] ?? "";
  return <WelcomeScreen firstName={firstName} next={safeNextPath(query.next)} />;
}

export default function WelcomePage(props: PageProps<"/welcome">) {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-16">
          <BrandLoader />
        </div>
      }
    >
      <Welcome {...props} />
    </Suspense>
  );
}
