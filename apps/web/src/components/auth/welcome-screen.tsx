"use client";

import { ArrowRight } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useNavigationPending } from "@/lib/use-navigation-pending";

// lottie-web touches `document` on import, so it only loads in the browser.
const WelcomeAnimation = dynamic(() => import("./welcome-animation"), {
  ssr: false,
  loading: () => <div className="size-36" />,
});

interface WelcomeScreenProps {
  firstName: string;
  /** Where the user goes once they agree. Already checked to be a same-origin path. */
  next: string;
}

/** Takes the place of the sign-up form for new accounts. The only way forward is agreeing. */
export function WelcomeScreen({ firstName, next }: WelcomeScreenProps) {
  const router = useRouter();
  const [pending, setPending] = useNavigationPending();

  function agree() {
    setPending(true);
    router.replace(next);
  }

  return (
    <section aria-labelledby="welcome-title" className="text-center">
      <div className="flex justify-center">
        <WelcomeAnimation />
      </div>
      <h1 id="welcome-title" className="mt-2 text-2xl font-semibold tracking-tight">
        {firstName ? `Welcome, ${firstName}!` : "Welcome to BillSafi!"}
      </h1>
      <p className="mt-3 text-sm text-ink">
        You&apos;re joining a growing community of happy small businesses that use BillSafi to send
        invoices and get paid on time.
      </p>
      <p className="mt-5 text-sm text-sub">
        By continuing, you agree to our{" "}
        <Link href="/terms" target="_blank" className="text-accent hover:underline">
          Terms of Use
        </Link>{" "}
        and confirm you have read our{" "}
        <Link href="/privacy" target="_blank" className="text-accent hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
      <Button type="button" pending={pending} onClick={agree} className="mt-6 w-full">
        Agree and continue
        {!pending && <ArrowRight aria-hidden className="size-4" />}
      </Button>
    </section>
  );
}
