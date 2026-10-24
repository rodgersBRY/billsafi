"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { queueIntroSplash } from "@/components/brand/intro-splash";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { authClient } from "@/lib/auth-client";
import { welcomePath } from "@/lib/welcome";

/** Error codes Better Auth adds to /sign-in when the Google round trip fails. */
function googleErrorMessage(code: string | null): string {
  switch (code) {
    case null:
      return "";
    case "account_not_linked":
      return "This email already has a BillSafi account with a password. Sign in with your password instead.";
    case "access_denied":
      return "Google sign-in was cancelled.";
    default:
      return "We couldn't sign you in with Google. Please try again.";
  }
}

interface GoogleSignInButtonProps {
  /** Where returning users land after Google. */
  callbackURL?: string;
  /** Where first-time users land after Google, by way of the welcome screen. */
  newUserCallbackURL?: string;
}

export function GoogleSignInButton({
  callbackURL = "/",
  newUserCallbackURL = "/onboarding",
}: GoogleSignInButtonProps) {
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(() => googleErrorMessage(searchParams.get("error")));

  async function onClick() {
    setPending(true);
    setError("");
    // sessionStorage survives the trip to Google, so the intro plays on arrival.
    queueIntroSplash();
    const { error } = await authClient.signIn.social({
      provider: "google",
      // Relative paths only; the API refuses redirects to other origins.
      callbackURL,
      newUserCallbackURL: welcomePath(newUserCallbackURL),
      errorCallbackURL: "/sign-in",
    });
    // On success the browser is already leaving for Google.
    if (error) {
      setPending(false);
      setError(googleErrorMessage("unknown"));
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        pending={pending}
        onClick={onClick}
        className="w-full"
      >
        {!pending && <FcGoogle aria-hidden className="size-4.5" />}
        Continue with Google
      </Button>
      <FormMessage>{error}</FormMessage>
    </>
  );
}
