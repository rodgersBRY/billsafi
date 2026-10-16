import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Choose a new password · TallyNest" };

export default function ResetPasswordPage() {
  return (
    // The form reads the token from the URL.
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
