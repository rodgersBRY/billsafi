import type { Metadata } from "next";
import { Stepper } from "@/components/onboarding/stepper";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create your account · Billsafi" };

export default function SignUpPage() {
  return (
    <>
      <Stepper current={1} />
      <SignUpForm />
    </>
  );
}
