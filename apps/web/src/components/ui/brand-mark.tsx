import Image from "next/image";

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Image src="/brand/logo-mark.webp" alt="" width={size} height={size} className="rounded-lg" />
      <span className="text-xl font-semibold tracking-tight text-accent">TallyNest</span>
    </span>
  );
}
