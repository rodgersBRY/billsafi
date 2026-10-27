import { getAdminOverview, getAdminSubscriptions } from "@/lib/server-api/admin";
import { formatCount, formatUsd } from "../admin-format";
import { subscriptionsHref } from "../admin-params";
import { KpiCard } from "../kpi-card";

/**
 * Headline plan figures. Paying, MRR and complimentary come from the overview; the
 * renewal and lapsed counts are the `total` of the filtered subscriptions list.
 */
export async function SubscriptionKpis() {
  const [overview, renewing, lapsed] = await Promise.all([
    getAdminOverview(),
    getAdminSubscriptions("?renewalWithin=7"),
    getAdminSubscriptions("?lapsedWithin=30"),
  ]);
  const cards = [
    {
      label: "Paying accounts",
      value: formatCount(overview.payingAccounts),
      definition: "On Pro, with the current month paid for.",
    },
    {
      label: "MRR",
      value: formatUsd(overview.mrrUsd),
      definition: "Paying accounts times the Pro price. Gifts left out.",
    },
    {
      label: "Complimentary Pro",
      value: formatCount(overview.complimentaryProAccounts),
      definition: "On Pro, with the current month a gift. Never revenue.",
    },
    {
      label: "Renewals due in 7 days",
      value: formatCount(renewing.total),
      definition: "Pro access ends within 7 days.",
      href: subscriptionsHref("subscriptions", { renewalWithin: 7 }),
    },
    {
      label: "Lapsed in 30 days",
      value: formatCount(lapsed.total),
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
