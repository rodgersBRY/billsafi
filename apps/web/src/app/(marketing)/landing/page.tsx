import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "BillSafi | Professional invoices for freelancers",
  description:
    "Create professional invoices, share them as a PDF or a link, and track who has paid. Free for 10 invoices a month.",
};

export const viewport: Viewport = {
  themeColor: "#102e30",
};

async function RuntimeLanding() {
  await connection();
  return <LandingPage appOrigin={process.env.APP_ORIGIN ?? ""} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RuntimeLanding />
    </Suspense>
  );
}
