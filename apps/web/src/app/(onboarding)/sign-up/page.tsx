import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { RegistrationClosedNotice } from "@/components/auth/registration-closed";
import { Stepper } from "@/components/onboarding/stepper";
import { StepPanel } from "@/components/onboarding/step-panel";
import { getPlatformInfo } from "@/lib/server-api/platform";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create your account · BillSafi" };

/** The form, or the admin's message while registration is closed. */
async function SignUp() {
  const { registration } = await getPlatformInfo();
  if (!registration.open) {
    return (
      <StepPanel title="Sign-ups are paused">
        <RegistrationClosedNotice message={registration.closedMessage} />
        <p className="mt-5 text-center text-sm text-sub">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </StepPanel>
    );
  }
  return (
    <SignUpForm
      google={
        <Suspense fallback={null}>
          <GoogleSignIn />
        </Suspense>
      }
    />
  );
}

export default function SignUpPage() {
  return (
    <>
      <Stepper current={1} />
      <Suspense fallback={null}>
        <SignUp />
      </Suspense>
    </>
  );
}
