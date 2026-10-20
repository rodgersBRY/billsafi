"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email"));
    setPending(true);
    setError("");
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setPending(false);
    if (error) {
      setError("We couldn't send the reset email. Try again in a moment.");
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div>
        <AuthHeading
          title="Check your email"
          description={`If ${sentTo} has a Billsafi account, a reset link is on its way. The link works for one hour.`}
        />
        <Link href="/sign-in" className="mt-6 inline-block text-sm text-accent hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={onSubmit}>
      <AuthHeading
        title="Reset your password"
        description="Enter your account email and we'll send you a link to choose a new password."
      />
      <TextField label="Email address" name="email" type="email" autoComplete="email" required />
      <FormMessage>{error}</FormMessage>
      <Button type="submit" pending={pending} className="mt-6 w-full">
        Send reset link
      </Button>
      <p className="mt-6 text-center text-sm">
        <Link href="/sign-in" className="text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
