import {
  getAdminGrants,
  getAdminOverrides,
  getAdminPlanPayments,
  getAdminSubscriptions,
} from "@/lib/server-api/admin";
import {
  hrefWith,
  parseGrantsParams,
  parseOverridesParams,
  parsePlanPaymentsParams,
  parseSubscriptionsParams,
  type RawParams,
  subscriptionsDefaults,
  subscriptionsHref,
  toQuery,
} from "../admin-params";
import { DirectorySection } from "../directory-section";
import { GrantsTable } from "./grants-table";
import { OverridesTable } from "./overrides-table";
import { PaymentsTable } from "./payments-table";
import {
  grantFilters,
  overrideFilters,
  paymentFilters,
  subscriptionFilters,
} from "./subscription-filters";
import { SubscriptionsTable } from "./subscriptions-table";

type Values = Record<string, string | number | undefined>;

/** Whether any filter beyond paging and sorting is set. */
const isFiltered = (state: Values) =>
  toQuery({ ...state, page: undefined, sort: undefined, dir: undefined }) !== "";

export async function SubscriptionsDirectory({ raw }: { raw: RawParams }) {
  const state = parseSubscriptionsParams(raw);
  const data = await getAdminSubscriptions(toQuery(state, subscriptionsDefaults));
  const href = (changes: Values) =>
    hrefWith("/admin/subscriptions", state, changes, subscriptionsDefaults);
  return (
    <DirectorySection
      label="Filter subscriptions"
      fields={subscriptionFilters}
      page={data}
      rows={data.subscriptions.length}
      filtered={isFiltered(state)}
      clearHref={subscriptionsHref("subscriptions")}
      pageHref={(page) => href({ page })}
      empty={{ title: "No accounts yet" }}
    >
      <SubscriptionsTable
        rows={data.subscriptions}
        sort={{ sort: state.sort, dir: state.dir }}
        sortHref={(sort, dir) => href({ sort, dir, page: 1 })}
      />
    </DirectorySection>
  );
}

/** A filtered list on one of the history tabs, with `tab` kept in every link. */
async function HistoryTab<
  S extends Values,
  D extends { generatedAt: string; page: number; pageSize: number; total: number },
>(props: {
  tab: "payments" | "grants" | "overrides";
  state: S;
  load: (query: string) => Promise<D>;
  rows: (data: D) => number;
  render: (data: D) => React.ReactNode;
  fields: typeof paymentFilters;
  label: string;
  empty: { title: string; description?: string };
}) {
  const data = await props.load(toQuery(props.state, { page: 1 }));
  return (
    <DirectorySection
      label={props.label}
      fields={props.fields}
      page={data}
      rows={props.rows(data)}
      filtered={isFiltered(props.state)}
      clearHref={subscriptionsHref(props.tab)}
      pageHref={(page) =>
        subscriptionsHref(props.tab, { ...props.state, page: page > 1 ? page : undefined })
      }
      empty={props.empty}
    >
      {props.render(data)}
    </DirectorySection>
  );
}

export function PaymentsDirectory({ raw }: { raw: RawParams }) {
  return (
    <HistoryTab
      tab="payments"
      state={parsePlanPaymentsParams(raw)}
      load={getAdminPlanPayments}
      rows={(data) => data.payments.length}
      render={(data) => <PaymentsTable payments={data.payments} />}
      fields={paymentFilters}
      label="Filter plan payments"
      empty={{ title: "No plan payments yet" }}
    />
  );
}

export function GrantsDirectory({ raw }: { raw: RawParams }) {
  return (
    <HistoryTab
      tab="grants"
      state={parseGrantsParams(raw)}
      load={getAdminGrants}
      rows={(data) => data.grants.length}
      render={(data) => <GrantsTable grants={data.grants} />}
      fields={grantFilters}
      label="Filter grants"
      empty={{
        title: "No grants yet",
        description: "Complimentary Pro months and credits show up here.",
      }}
    />
  );
}

export function OverridesDirectory({ raw }: { raw: RawParams }) {
  return (
    <HistoryTab
      tab="overrides"
      state={parseOverridesParams(raw)}
      load={getAdminOverrides}
      rows={(data) => data.overrides.length}
      render={(data) => <OverridesTable overrides={data.overrides} />}
      fields={overrideFilters}
      label="Filter limit overrides"
      empty={{ title: "No limit overrides yet" }}
    />
  );
}
