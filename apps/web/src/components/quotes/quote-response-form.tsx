"use client";

import { acceptQuoteSchema, type PublicQuote } from "@billsafi/contracts";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { apiPost } from "@/lib/api.client";
import { ApiError } from "@/lib/api-error";

type Errors = Record<string, string>;

export function QuoteResponseForm({ token, quote }: { token: string; quote: PublicQuote }) {
  const router = useRouter();
  const agreeId = useId();
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState("");
  // Version the client saw when told it changed; hidden once the page loads a newer one.
  const [changedAt, setChangedAt] = useState<number | null>(null);
  const changed = changedAt === quote.version;

  const path = `/public/quotes/${encodeURIComponent(token)}`;

  async function send(kind: "accept" | "decline", body: unknown) {
    setPending(kind);
    setErrors({});
    setMessage("");
    setChangedAt(null);
    try {
      await apiPost(`${path}/${kind}`, body);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "QUOTE_CHANGED") {
          setChangedAt(quote.version);
        } else if (error.code === "QUOTE_EXPIRED" || error.code === "QUOTE_ALREADY_RESPONDED") {
          setMessage(error.message);
          router.refresh();
        } else if (error.status === 429) {
          setMessage("Too many tries. Wait a minute and try again.");
        } else {
          setErrors(error.fieldErrors());
          setMessage(Object.keys(error.fieldErrors()).length ? "" : error.message);
        }
      } else {
        setMessage("Something went wrong. Try again.");
      }
    } finally {
      setPending(null);
    }
  }

  function accept(event: React.FormEvent) {
    event.preventDefault();
    const body = { name, agreed, version: quote.version };
    const parsed = acceptQuoteSchema.safeParse(body);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    void send("accept", parsed.data);
  }

  function decline(event: React.FormEvent) {
    event.preventDefault();
    void send("decline", { reason, version: quote.version });
  }

  return (
    <section className="mt-6 rounded-panel border border-line bg-panel p-5">
      {declining ? (
        <form onSubmit={decline} noValidate>
          <h2 className="text-base font-semibold">Decline this quote</h2>
          <TextAreaField
            label="Reason · Optional"
            value={reason}
            error={errors.reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="submit" pending={pending === "decline"}>
              Send
            </Button>
            <Button type="button" variant="secondary" onClick={() => setDeclining(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={accept} noValidate>
          <h2 className="text-base font-semibold">Accept this quote</h2>
          <TextField
            label="Your full name"
            autoComplete="name"
            value={name}
            error={errors.name}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="mt-4">
            <label htmlFor={agreeId} className="flex items-center gap-2 text-sm">
              <input
                id={agreeId}
                type="checkbox"
                checked={agreed}
                aria-invalid={errors.agreed ? true : undefined}
                aria-describedby={errors.agreed ? `${agreeId}-error` : undefined}
                onChange={(event) => setAgreed(event.target.checked)}
                className="size-4 accent-teal"
              />
              I agree to this quote
            </label>
            {errors.agreed && (
              <p id={`${agreeId}-error`} className="mt-1.5 text-xs text-red-700 dark:text-red-300">
                {errors.agreed}
              </p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="submit" pending={pending === "accept"}>
              <Check aria-hidden className="size-4" />
              Accept
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDeclining(true)}>
              Decline
            </Button>
          </div>
        </form>
      )}
      <FormMessage>{message}</FormMessage>
      {changed && (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <p role="alert">This quote was just updated. Reload to see the new version.</p>
          <Button type="button" variant="secondary" onClick={() => router.refresh()}>
            Reload
          </Button>
        </div>
      )}
    </section>
  );
}
