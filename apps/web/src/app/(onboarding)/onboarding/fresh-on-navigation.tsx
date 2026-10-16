"use client";

import { useRouter } from "next/navigation";
import { Fragment } from "react";

/** Resets the subtree on link or push navigations, keeps it on back/forward. */
export function FreshOnNavigation({ children }: { children: React.ReactNode }) {
  const { bfcacheId } = useRouter();
  return <Fragment key={bfcacheId}>{children}</Fragment>;
}
