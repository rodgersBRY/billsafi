"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const STORAGE_KEY = "tallynest:intro";
const MAX_DURATION_MS = 2000;
const PLAYBACK_RATE = 2;
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
  const videoRef = useRef<HTMLVideoElement>(null);

  // Layout effect so client-side navigation after login shows the splash before paint.
  useLayoutEffect(() => {
    if (takeQueuedIntro()) {
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
      const video = videoRef.current;
      if (video) {
        video.muted = true;
        video.playbackRate = PLAYBACK_RATE;
        video.play().catch(finish);
      }
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
      aria-label="Welcome to TallyNest"
      onClick={finish}
      className={`fixed inset-0 z-50 place-items-center bg-brand-night transition-opacity duration-300 intro:grid ${
        visible ? "grid" : "hidden"
      } ${phase === "leaving" ? "opacity-0" : "opacity-100"}`}
    >
      {visible && (
        <video
          ref={videoRef}
          className="size-80 max-w-[80vw] object-contain [mask-image:radial-gradient(closest-side,black_75%,transparent)]"
          poster="/brand/logo-poster.webp"
          onEnded={finish}
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
        >
          <source src="/brand/logo-animation.webm" type="video/webm" />
          <source src="/brand/logo-animation.mp4" type="video/mp4" />
        </video>
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
