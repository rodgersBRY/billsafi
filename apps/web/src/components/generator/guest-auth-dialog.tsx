"use client";

import { REGISTRATION_CLOSED_CODE } from "@billsafi/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { queueIntroSplash } from "@/components/brand/intro-splash";
import { Button } from "@/components/ui/button";
import { RegistrationClosedNotice } from "@/components/auth/registration-closed";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { FormMessage } from "@/components/ui/form-message";
import { authClient } from "@/lib/auth-client";
import { sendGeneratorEvent } from "@/lib/generator-events";
import { useNavigationPending } from "@/lib/use-navigation-pending";
import { welcomePath } from "@/lib/welcome";

export const FINISH_PATH = "/free-invoice-generator/finish";

const MIN_PASSWORD_LENGTH = 8;

type Mode = "sign-up" | "sign-in";

interface GuestAuthDialogProps {
  open: boolean;
  onClose: () => void;
  /** Server-rendered "Continue with Google" block (with its "or" divider), when available. */
  google?: React.ReactNode;
  /** The admin's message while sign-ups are closed; null when they are open. */
  closedMessage?: string | null;
}

export function GuestAuthDialog({
  open,
  onClose,
  google,
  closedMessage = null,
}: GuestAuthDialogProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-up");
  const [errors, setErrors] = useState<{ name?: string; password?: string; form?: string }>({});
  const [pending, setPending] = useNavigationPending();
  const [email, setEmail] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const focusPassword = useRef(false);
  const signUp = mode === "sign-up";
  const paused = signUp && closedMessage !== null;

  // The submit button unmounts on the auto-switch, so hand focus to the password field.
  useEffect(() => {
    if (!focusPassword.current) return;
    focusPassword.current = false;
    formRef.current?.querySelector<HTMLInputElement>('input[name="password"]')?.focus();
  }, [mode]);

  function close() {
    setMode("sign-up");
    setErrors({});
    onClose();
  }

  function switchMode(next: Mode, form = "") {
    setMode(next);
    setErrors(form ? { form } : {});
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signUp) sendGeneratorEvent("generator_signup_clicked");
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    const email = String(data.get("email")).trim();
    setEmail(email);
    const password = String(data.get("password"));

    if (signUp) {
      const name = String(data.get("name")).trim();
      if (!name) return setErrors({ name: "Enter your full name." });
      if (password.length < MIN_PASSWORD_LENGTH) {
        return setErrors({ password: `Use at least ${MIN_PASSWORD_LENGTH} characters.` });
      }
      setPending(true);
      setErrors({});
      const { error } = await authClient.signUp.email({ name, email, password });
      if (error) {
        setPending(false);
        if (error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
          focusPassword.current = true;
          return switchMode(
            "sign-in",
            "You already have an account with this email. Sign in to save your invoice.",
          );
        }
        return setErrors({
          form:
            error.code === REGISTRATION_CLOSED_CODE
              ? (error.message ?? "Sign-ups are paused for now.")
              : (error.message ?? "We couldn't create your account."),
        });
      }
    } else {
      setPending(true);
      setErrors({});
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        setPending(false);
        return setErrors({
          form:
            error.status === 401
              ? "That email and password don't match."
              : "We couldn't sign you in.",
        });
      }
    }
    // Next.js keeps this page alive; don't leave the password sitting in it.
    setEmail("");
    formElement.reset();
    queueIntroSplash();
    // Only new accounts see the welcome screen.
    router.replace(signUp ? welcomePath(FINISH_PATH) : FINISH_PATH);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={
        signUp
          ? paused
            ? "Sign-ups are paused"
            : "Save your invoice"
          : "Sign in to save your invoice"
      }
      description={
        paused
          ? "Your invoice stays in this browser. Sign in if you already have an account."
          : "Your invoice is saved to your account as a draft. Check it, then mark it Ready to download the PDF."
      }
    >
      {paused ? <RegistrationClosedNotice message={closedMessage} /> : google}
      {/* Keyed so switching modes clears the typed values and field state. */}
      <form
        key={mode}
        ref={formRef}
        method="post"
        onSubmit={onSubmit}
        onChange={(event) => {
          const field = event.nativeEvent.target as HTMLInputElement;
          if (field.name === "email") setEmail(field.value);
        }}
        hidden={paused}
        className={google ? "" : "mt-4"}
      >
        {signUp && (
          <TextField
            label="Full name"
            name="name"
            autoComplete="name"
            error={errors.name}
            required
          />
        )}
        <TextField
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={email}
          required
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete={signUp ? "new-password" : "current-password"}
          hint={signUp ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
          error={signUp ? errors.password : undefined}
          required
        />
        <FormMessage>{errors.form}</FormMessage>
        <Button type="submit" pending={pending} className="mt-6 w-full">
          {signUp ? "Create account and save" : "Sign in and save"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-sub">
        {signUp ? "Already have an account? " : "New to BillSafi? "}
        <button
          type="button"
          onClick={() => switchMode(signUp ? "sign-in" : "sign-up")}
          className="text-accent hover:underline"
        >
          {signUp ? "Sign in" : "Create an account"}
        </button>
      </p>
    </Dialog>
  );
}
