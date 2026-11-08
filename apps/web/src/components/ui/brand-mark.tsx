import Image from "next/image";

export function BrandMark({
  size = 32,
  labelClassName = "",
}: {
  size?: number;
  /** Hides the name in a collapsed sidebar. */
  labelClassName?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Image
        src="/brand/logo-mark.png"
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-lg"
      />
      <span
        className={`text-xl font-semibold tracking-tight whitespace-nowrap text-accent ${labelClassName}`}
      >
        BillSafi
      </span>
    </span>
  );
}
