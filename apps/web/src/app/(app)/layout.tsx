import { IntroSplash } from "@/components/brand/intro-splash";

/** Signed-in application shell. Navigation and business selector arrive in Phase 1. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <IntroSplash />
      {children}
    </>
  );
}
