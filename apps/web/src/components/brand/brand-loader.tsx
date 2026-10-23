import Image from "next/image";
import { BRAND_BADGE_SRC } from "./badge";

type BrandLoaderProps = {
  /** Accessible status text announced to screen readers. */
  label?: string;
  className?: string;
};

/** Pulsing Billsafi badge while a page loads. */
export function BrandLoader({ label = "Loading", className = "" }: BrandLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`grid size-40 place-items-center ${className}`}
    >
      <Image
        src={BRAND_BADGE_SRC}
        alt=""
        width={144}
        height={144}
        className="animate-pulse motion-reduce:animate-none"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
