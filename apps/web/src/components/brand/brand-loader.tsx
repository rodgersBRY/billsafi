"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

type BrandLoaderProps = {
  /** Accessible status text announced to screen readers. */
  label?: string;
  className?: string;
};

/**
 * Animated TallyNest logo for page-level loading. Users who prefer reduced
 * motion see the final logo frame instead. Inline waits (buttons, table rows)
 * should use a small spinner, not this.
 */
export function BrandLoader({ label = "Loading", className = "" }: BrandLoaderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // React does not reliably render `muted` in server HTML, and browsers only
    // autoplay muted video, so start playback explicitly after hydration.
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.play().catch(() => {
      // Autoplay refused (for example, data saver); the poster stays visible.
    });
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`relative size-40 overflow-hidden rounded-panel bg-brand-night ${className}`}
    >
      <video
        ref={videoRef}
        className="size-full object-cover motion-reduce:hidden"
        poster="/brand/logo-poster.webp"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      >
        <source src="/brand/logo-animation.webm" type="video/webm" />
        <source src="/brand/logo-animation.mp4" type="video/mp4" />
      </video>
      <Image
        src="/brand/logo-poster.webp"
        alt=""
        width={320}
        height={320}
        className="hidden size-full object-cover motion-reduce:block"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
