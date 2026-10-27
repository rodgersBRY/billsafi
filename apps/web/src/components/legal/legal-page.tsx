import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { getPlatformInfo } from "@/lib/server-api/platform";
import { BrandMark } from "@/components/ui/brand-mark";
import { LEGAL } from "./legal-info";

export type LegalSection = { id: string; heading: string; body: ReactNode };

/** Shared shell for the Terms of Use and Privacy Policy: header, contents list, sections, footer. */
export function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between py-4">
        <Link href="/" aria-label="BillSafi home">
          <BrandMark />
        </Link>
        <Link href="/sign-in" className="text-sm font-medium text-accent hover:underline">
          Sign in
        </Link>
      </header>

      <main className="mt-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-base text-sub">Last updated {LEGAL.lastUpdated}</p>
        <div className="legal-body mt-6">{intro}</div>

        <nav
          aria-label="Contents"
          className="mt-8 rounded-panel border border-line bg-panel p-5 text-base"
        >
          <p className="font-semibold">Contents</p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sub">
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="hover:text-accent hover:underline">
                  {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {sections.map((section, index) => (
          <section key={section.id} id={section.id} className="mt-10 scroll-mt-6">
            <h2 className="text-xl font-semibold tracking-tight">
              {index + 1}. {section.heading}
            </h2>
            <div className="legal-body mt-3">{section.body}</div>
          </section>
        ))}
      </main>

      <footer className="mt-16 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6 text-sm text-sub">
        <span>
          © 2026 {LEGAL.company}. {LEGAL.product}
        </span>
        <Link href="/terms" className="hover:text-accent hover:underline">
          Terms of Use
        </Link>
        <Link href="/privacy" className="hover:text-accent hover:underline">
          Privacy Policy
        </Link>
        <SupportEmail className="hover:text-accent hover:underline" />
      </footer>
    </div>
  );
}

/** The support email from the platform settings, falling back to the built-in address. */
async function LiveSupportEmail({ className }: { className: string }) {
  const { supportContact } = await getPlatformInfo();
  return (
    <a href={`mailto:${supportContact.email}`} className={className}>
      {supportContact.email}
    </a>
  );
}

function SupportEmail({ className }: { className: string }) {
  return (
    <Suspense
      fallback={
        <a href={`mailto:${LEGAL.contactEmail}`} className={className}>
          {LEGAL.contactEmail}
        </a>
      }
    >
      <LiveSupportEmail className={className} />
    </Suspense>
  );
}

/** Mail link to the support address. */
export function ContactEmail() {
  return <SupportEmail className="font-medium text-accent hover:underline" />;
}
