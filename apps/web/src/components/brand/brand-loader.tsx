import Image from "next/image";

type BrandLoaderProps = {
  /** Accessible status text announced to screen readers. */
  label?: string;
  className?: string;
};

/** Pulsing mark while a page loads; mark only until new brand assets exist (D053). */
export function BrandLoader({ label = "Loading", className = "" }: BrandLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`grid size-40 place-items-center rounded-panel bg-brand-night ${className}`}
    >
      <Image
        src="/brand/logo-mark.webp"
        alt=""
        width={96}
        height={96}
        className="animate-pulse motion-reduce:animate-none"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
