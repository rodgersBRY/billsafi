import Link from "next/link";

export interface UrlTab {
  key: string;
  label: string;
  href: string;
}

/** Section links kept in the URL (?tab=), so each one can be linked and reloaded. */
export function UrlTabs({
  label,
  tabs,
  current,
}: {
  label: string;
  tabs: UrlTab[];
  current: string;
}) {
  return (
    <nav aria-label={label} className="mb-4 overflow-x-auto border-b border-line">
      <ul className="flex gap-1">
        {tabs.map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.href}
              replace
              scroll={false}
              aria-current={tab.key === current ? "page" : undefined}
              className="-mb-px inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm whitespace-nowrap text-sub hover:text-ink aria-[current=page]:border-teal aria-[current=page]:font-medium aria-[current=page]:text-ink"
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
