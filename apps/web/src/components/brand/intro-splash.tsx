"use client";

import Image from "next/image";
import { BRAND_BADGE_SRC } from "./badge";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const STORAGE_KEY = "billsafi:intro";
const MAX_DURATION_MS = 1200;
const FADE_MS = 300;

/**
 * Runs before hydration (see app/layout.tsx) so a full page load after login
 * shows the splash backdrop on first paint instead of flashing the app.
 */
export const introSplashBootScript = `try{if(sessionStorage.getItem("${STORAGE_KEY}")&&!matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.dataset.intro=""}}catch(e){}`;

/** Call after a successful login or registration, before navigating into the app. */
export function queueIntroSplash(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Storage blocked: skip the intro rather than fail the login.
  }
}

function takeQueuedIntro(): boolean {
  try {
    const queued = sessionStorage.getItem(STORAGE_KEY) === "1";
    sessionStorage.removeItem(STORAGE_KEY);
    return queued && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

type Phase = "idle" | "playing" | "leaving";

export function IntroSplash() {
  const [phase, setPhase] = useState<Phase>("idle");
  // Strict Mode runs effects twice; a second run would find the queue empty and
  // clear data-intro while the splash still plays, letting the tour start under it.
  const claimed = useRef(false);

  // Layout effect so client-side navigation after login shows the splash before paint.
  useLayoutEffect(() => {
    if (claimed.current) return;
    claimed.current = true;
    if (takeQueuedIntro()) {
      // Also marks client-side arrivals, so the product tour waits for the splash (D057).
      document.documentElement.dataset.intro = "";
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser-only storage once on mount
      setPhase("playing");
    } else {
      delete document.documentElement.dataset.intro;
    }
  }, []);

  const finish = useCallback(() => {
    setPhase((current) => (current === "playing" ? "leaving" : current));
  }, []);

  useEffect(() => {
    if (phase === "playing") {
      const cap = window.setTimeout(finish, MAX_DURATION_MS);
      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") finish();
      };
      window.addEventListener("keydown", onKey);
      return () => {
        window.clearTimeout(cap);
        window.removeEventListener("keydown", onKey);
      };
    }
    if (phase === "leaving") {
      const done = window.setTimeout(() => {
        delete document.documentElement.dataset.intro;
        setPhase("idle");
      }, FADE_MS);
      return () => window.clearTimeout(done);
    }
  }, [phase, finish]);

  const visible = phase !== "idle";

  return (
    <div
      aria-label="Welcome to BillSafi"
      onClick={finish}
      className={`fixed inset-0 z-50 place-items-center bg-brand-night transition-opacity duration-300 intro:grid ${
        visible ? "grid" : "hidden"
      } ${phase === "leaving" ? "opacity-0" : "opacity-100"}`}
    >
      {visible && (
        <div aria-hidden className="animate-pulse motion-reduce:animate-none">
          {/* The badge already carries the name, so no separate wordmark here. */}
          <Image src={BRAND_BADGE_SRC} alt="" width={192} height={192} priority />
        </div>
      )}
      <button
        type="button"
        onClick={finish}
        className="absolute right-4 bottom-4 rounded-lg px-4 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
      >
        Skip
      </button>
    </div>
  );
}
