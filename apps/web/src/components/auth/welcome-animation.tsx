"use client";

import { useLottieSvg } from "lottie-react";
import animation from "./animations/welcome.json";

const LAST_FRAME = animation.op - 1;

/** Badge pops in, a check draws itself, confetti bursts. Reduced motion shows the final frame. */
export default function WelcomeAnimation() {
  // Loaded with ssr: false, so window is always there.
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const { setDisplayRef } = useLottieSvg({
    src: animation,
    autoplay: true,
    loop: false,
    segment: reducedMotion ? [LAST_FRAME, animation.op] : undefined,
  });
  return <div aria-hidden ref={setDisplayRef} className="size-36" />;
}
