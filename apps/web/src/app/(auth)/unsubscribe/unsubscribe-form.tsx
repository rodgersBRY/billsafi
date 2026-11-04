"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { apiPost } from "@/lib/api.client";

/**
 * Asks for a click instead of unsubscribing on page load, so link scanners in mail
 * systems can't unsubscribe people by opening the link (D069).
 */
export function UnsubscribeForm() {
  const token = useSearchParams().get("token");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await apiPost("/email-preferences/unsubscribe", { token });
      setDone(true);
    } catch {
      setError("We couldn't unsubscribe you. Try again in a moment.");
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <AuthHeading
        title="This link is incomplete"
        description="Open the unsubscribe link from the email again."
      />
    );
  }

  if (done) {
    return (
      <div>
        <AuthHeading
          title="You're unsubscribed"
          description="We won't send you any more check-in emails. You'll still get account emails like password resets."
        />
        <Link href="/" className="mt-6 inline-block text-sm text-accent hover:underline">
          Go to BillSafi
        </Link>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={onSubmit}>
      <AuthHeading
        title="Unsubscribe from check-in emails"
        description="You'll still get account emails like password resets."
      />
      <FormMessage>{error}</FormMessage>
      <Button type="submit" pending={pending} className="mt-6 w-full">
        Unsubscribe
      </Button>
    </form>
  );
}
