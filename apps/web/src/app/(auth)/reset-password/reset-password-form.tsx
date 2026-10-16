"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { authClient } from "@/lib/auth-client";

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  if (!token || searchParams.get("error")) {
    return (
      <div>
        <AuthHeading
          title="This link has expired"
          description="Reset links work once and only for one hour. Request a new one to continue."
        />
        <Link
          href="/forgot-password"
          className="mt-6 inline-block text-sm text-teal hover:underline"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <AuthHeading
          title="Password updated"
          description="For your security, you've been signed out on every device. Sign in with your new password."
        />
        <Link href="/sign-in" className="mt-6 inline-block text-sm text-teal hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    const confirm = String(form.get("confirm"));
    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrors({ password: `Use at least ${MIN_PASSWORD_LENGTH} characters.` });
      return;
    }
    if (password !== confirm) {
      setErrors({ confirm: "The passwords don't match." });
      return;
    }
    setPending(true);
    setErrors({});
    const { error } = await authClient.resetPassword({ newPassword: password, token: token! });
    setPending(false);
    if (error) {
      setErrors({ form: "This link is no longer valid. Request a new one." });
      return;
    }
    setDone(true);
  }

  return (
    <form method="post" onSubmit={onSubmit}>
      <AuthHeading title="Choose a new password" />
      <TextField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        error={errors.password}
        required
      />
      <TextField
        label="Confirm new password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        error={errors.confirm}
        required
      />
      <FormMessage>{errors.form}</FormMessage>
      <Button type="submit" pending={pending} className="mt-6 w-full">
        Update password
      </Button>
    </form>
  );
}
