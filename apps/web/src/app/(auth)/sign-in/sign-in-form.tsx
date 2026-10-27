"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { queueIntroSplash } from "@/components/brand/intro-splash";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { FormMessage } from "@/components/ui/form-message";
import { authClient } from "@/lib/auth-client";
import { SUSPENDED_ACCOUNT_MESSAGE, isBannedError } from "@/lib/suspended-account";
import { useNavigationPending } from "@/lib/use-navigation-pending";

/** `google` is the server-rendered "Continue with Google" block, when available. */
export function SignInForm({ google }: { google?: React.ReactNode }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useNavigationPending();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    setPending(true);
    setError("");

    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });

    if (error) {
      setPending(false);
      setError(
        isBannedError(error.code)
          ? SUSPENDED_ACCOUNT_MESSAGE
          : error.status === 401
            ? "That email and password don't match."
            : "We couldn't sign you in.",
      );

      return;
    }

    formElement.reset();

    queueIntroSplash();

    router.replace("/");
    router.refresh();
  }

  return (
    <form method="post" onSubmit={onSubmit}>
      <AuthHeading title="Welcome back" description="Sign in to manage your invoices." />
      {google}
      <TextField label="Email address" name="email" type="email" autoComplete="email" required />
      <PasswordField label="Password" name="password" autoComplete="current-password" required />

      <div className="mt-2 text-right">
        <Link href="/forgot-password" className="text-xs text-accent hover:underline">
          Forgot password?
        </Link>
      </div>

      <FormMessage>{error}</FormMessage>

      <Button type="submit" pending={pending} className="mt-6 w-full">
        Sign in
      </Button>

      <p className="mt-6 text-center text-sm text-sub">
        New to BillSafi?{" "}
        <Link href="/sign-up" className="text-accent hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
