import type { Metadata, Viewport } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "BillSafi — Good work deserves a great invoice.",
  description:
    "BillSafi — professional invoices, organised clients, and a clearer picture of what you’re owed. A sample for Kenyan freelancers.",
};

export const viewport: Viewport = {
  themeColor: "#102e30",
};

export default function Page() {
  return <LandingPage />;
}
