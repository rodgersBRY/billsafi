import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { FINISH_PATH } from "@/components/generator/guest-auth-dialog";
import { GuestInvoiceForm } from "@/components/generator/guest-invoice-form";
import { BrandMark } from "@/components/ui/brand-mark";

export const metadata: Metadata = {
  title: "Free invoice generator for freelancers · BillSafi",
  description:
    "Make a professional invoice in your browser. Add your details, your client and what you're billing for, then save it as a PDF with a free BillSafi account.",
};

export default function FreeInvoiceGeneratorPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between py-4">
        <Link href="/" aria-label="BillSafi home">
          <BrandMark />
        </Link>
        <Link href="/sign-in" className="text-sm font-medium text-accent hover:underline">
          Sign in
        </Link>
      </header>
      <main>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
          Free invoice generator
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-sub">
          Fill in your details and watch the invoice take shape. It&apos;s saved in this browser. A
          free account is needed to save and download. It takes 10 seconds.
        </p>
        {/* The Google button reads ?error= from the URL, so it needs its own boundary. */}
        <GuestInvoiceForm
          google={
            <Suspense fallback={null}>
              <GoogleSignIn callbackURL={FINISH_PATH} newUserCallbackURL={FINISH_PATH} />
            </Suspense>
          }
        />
      </main>
    </div>
  );
}
