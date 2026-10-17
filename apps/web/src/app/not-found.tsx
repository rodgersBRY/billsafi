import { SearchX } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/ui/brand-mark";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <BrandMark size={32} />
      <SearchX aria-hidden className="size-8 text-sub" />
      <h1 className="text-xl font-semibold tracking-tight">We couldn&apos;t find that page</h1>
      <p className="max-w-sm text-sm text-sub">
        The link may be old, or the page belongs to a different account.
      </p>
      <Link
        href="/"
        className="inline-flex items-center rounded-panel border border-teal bg-teal px-3.75 py-2.75 text-sm font-medium text-white hover:bg-teal/90"
      >
        Go to start
      </Link>
    </main>
  );
}
