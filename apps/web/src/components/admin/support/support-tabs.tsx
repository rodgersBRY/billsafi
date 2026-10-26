import type { SupportTab } from "@billsafi/contracts";
import { type SupportState, supportHref } from "../admin-params";
import { UrlTabs } from "../url-tabs";

const labels: Record<SupportTab, string> = {
  open: "Open",
  waiting: "Waiting",
  recent: "Recently updated",
  resolved: "Resolved",
};

/** Open, Waiting, Recently updated and Resolved, kept in the URL with the filters. */
export function SupportTabs({ state }: { state: SupportState }) {
  return (
    <UrlTabs
      label="Case lists"
      current={state.tab}
      tabs={(Object.keys(labels) as SupportTab[]).map((tab) => ({
        key: tab,
        label: labels[tab],
        href: supportHref({ ...state, tab, page: undefined }),
      }))}
    />
  );
}
