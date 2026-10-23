import type { Metadata } from "next";
import { Suspense } from "react";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { Stepper } from "@/components/onboarding/stepper";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create your account · BillSafi" };

export default function SignUpPage() {
  return (
    <>
      <Stepper current={1} />
      <SignUpForm
        google={
          <Suspense fallback={null}>
            <GoogleSignIn />
          </Suspense>
        }
      />
    </>
  );
}
