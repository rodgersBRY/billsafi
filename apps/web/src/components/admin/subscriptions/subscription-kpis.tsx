import { getAdminOverview } from "@/lib/server-api/admin";
import { formatCount, formatUsd } from "../admin-format";
import { subscriptionsHref } from "../admin-params";
import { KpiCard } from "../kpi-card";

/**
 * Headline plan figures, all from the overview (30 day range; the figures shown here are
 * current values, so the range does not change them). Renewal and lapsed counts are the
 * attention counts, which equal the totals of the filtered lists they link to.
 */
export async function SubscriptionKpis() {
  const overview = await getAdminOverview("30d");
  const cards = [
    {
      label: "Paying accounts",
      value: formatCount(overview.payingAccounts.current),
      definition: "On Pro, with the current month paid for.",
    },
    {
      label: "MRR",
      value: formatUsd(overview.mrrUsd.current),
      definition: "Paying accounts times the Pro price. Gifts left out.",
    },
    {
      label: "Complimentary Pro",
      value: formatCount(overview.complimentaryProAccounts.current),
      definition: "On Pro, with the current month a gift. Never revenue.",
    },
    {
      label: "Renewals due in 7 days",
      value: formatCount(overview.attention.proEnding),
      definition: "Pro access ends within 7 days.",
      href: subscriptionsHref("subscriptions", { renewalWithin: 7 }),
    },
    {
      label: "Lapsed in 30 days",
      value: formatCount(overview.attention.proLapsed),
      definition: "Pro ended in the last 30 days without renewal.",
      href: subscriptionsHref("subscriptions", { lapsedWithin: 30 }),
    },
  ];
  return (
    <ul className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <li key={card.label}>
          <KpiCard {...card} />
        </li>
      ))}
    </ul>
  );
}
