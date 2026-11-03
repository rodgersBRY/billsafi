import type { Metadata } from "next";
import { Suspense } from "react";
import { UnsubscribeForm } from "./unsubscribe-form";

export const metadata: Metadata = {
  title: "Unsubscribe · BillSafi",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function UnsubscribePage() {
  return (
    // The form reads the token from the URL.
    <Suspense>
      <UnsubscribeForm />
    </Suspense>
  );
}
