"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StepPanel } from "@/components/onboarding/step-panel";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { authClient } from "@/lib/auth-client";

const MIN_PASSWORD_LENGTH = 8;

/** `google` is the server-rendered "Continue with Google" block, when available. */
export function SignUpForm({ google }: { google?: React.ReactNode }) {
  const router = useRouter();
  const [errors, setErrors] = useState<{ name?: string; password?: string; form?: string }>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    const password = String(form.get("password"));
    if (!name) return setErrors({ name: "Enter your full name." });
    if (password.length < MIN_PASSWORD_LENGTH) {
      return setErrors({ password: `Use at least ${MIN_PASSWORD_LENGTH} characters.` });
    }
    setPending(true);
    setErrors({});
    const { error } = await authClient.signUp.email({
      name,
      email: String(form.get("email")).trim(),
      password,
    });
    if (error) {
      setPending(false);
      setErrors({
        form:
          error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
            ? "An account with this email already exists. Sign in instead."
            : (error.message ?? "We couldn't create your account."),
      });
      return;
    }
    router.replace("/onboarding");
    router.refresh();
  }

  return (
    <StepPanel
      title="Make room for your next project."
      description="Create your account to get started."
    >
      {google}
      <form method="post" onSubmit={onSubmit}>
        <TextField label="Full name" name="name" autoComplete="name" error={errors.name} required />
        <TextField label="Email address" name="email" type="email" autoComplete="email" required />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          error={errors.password}
          required
        />
        <FormMessage>{errors.form}</FormMessage>
        <Button type="submit" pending={pending} className="mt-6 w-full">
          Create account
        </Button>
        <p className="mt-5 text-center text-sm text-sub">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </StepPanel>
  );
}
