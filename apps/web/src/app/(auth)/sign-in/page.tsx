import type { Metadata } from "next";
import { Suspense } from "react";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { RegistrationClosedFromUrl } from "@/components/auth/registration-closed-from-url";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in · BillSafi" };

export default function SignInPage() {
  return (
    <SignInForm
      notice={
        <Suspense fallback={null}>
          <RegistrationClosedFromUrl />
        </Suspense>
      }
      google={
        // Streams in after the static form; empty if Google is not set up.
        <Suspense fallback={null}>
          <GoogleSignIn />
        </Suspense>
      }
    />
  );
}
