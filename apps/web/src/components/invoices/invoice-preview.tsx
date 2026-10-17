import type { InvoiceBusinessDetails, InvoiceStatus } from "@tallynest/contracts";
import { billToLines, formatKenyanPhone, type InvoiceCalculation } from "@tallynest/domain";
import { StatusPill } from "@/components/ui/status-pill";
import { formatAmount, formatDate } from "@/lib/format";

export interface PreviewProps {
  business: InvoiceBusinessDetails;
  client: { name: string; companyName: string | null } | null;
  invoiceNumber: string | null;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  items: { description: string; quantity: string; unitPrice: string }[];
  totals: InvoiceCalculation | null;
  discountLabel: string | null;
  taxRate: string | null;
  paymentInstructions: string;
  notes: string;
  /** Recorded payments; omitted while editing a draft. */
  paymentsReceived?: string;
  balanceDue?: string;
  overdue?: boolean;
  /** Where the business logo is served from, when it has one (D052). */
  logoSrc?: string | null;
  /** "Created with TallyNest" for Free accounts on the public page (D052). */
  showBranding?: boolean;
}

/** Stored quantities come back as "1.00"; show them as typed numbers ("1", "2.5"). */
function displayQuantity(value: string) {
  return /^\d+(\.\d+)?$/.test(value) ? Number(value).toString() : value;
}

function safeDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(value) : "—";
}

/** Approved invoice layout (D025, D030): compact payment summary, no payment history. */
export function InvoicePreview(props: PreviewProps) {
  const { business, client, totals } = props;
  return (
    <article
      aria-label="Invoice preview"
      className="rounded-panel border border-line bg-panel p-5 text-sm shadow-sm sm:p-7"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          {props.logoSrc && (
            // eslint-disable-next-line @next/next/no-img-element -- served by the API, sized by CSS
            <img
              src={props.logoSrc}
              alt={`${business.displayName} logo`}
              className="mb-2.5 max-h-12 max-w-32 object-contain"
            />
          )}
          <p className="text-base font-semibold">{business.displayName}</p>
          <p className="text-xs text-sub">{business.contactEmail}</p>
          <p className="text-xs text-sub">{formatKenyanPhone(business.phone)}</p>
          {business.address && <p className="text-xs text-sub">{business.address}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs tracking-widest text-sub">INVOICE</p>
          <p className="text-base font-semibold">{props.invoiceNumber ?? "Draft"}</p>
          <div className="mt-1">
            <StatusPill status={props.status} overdue={props.overdue} />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 border-b border-line py-5">
        <div>
          <p className="text-xs text-sub">Bill to</p>
          {client ? (
            billToLines(client.name, client.companyName).map((line, index) => (
              <p key={line} className={index === 0 ? "font-medium" : "text-sub"}>
                {line}
              </p>
            ))
          ) : (
            <p className="text-sub">Choose a client</p>
          )}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-right text-xs">
          <dt className="text-sub">Issued</dt>
          <dd>{safeDate(props.issueDate)}</dd>
          <dt className="text-sub">Due</dt>
          <dd>{safeDate(props.dueDate)}</dd>
        </dl>
      </div>

      <table className="mt-4 w-full text-sm">
        <thead className="text-left text-xs text-sub">
          <tr>
            <th scope="col" className="pb-2 font-normal">
              Service
            </th>
            <th scope="col" className="pb-2 text-right font-normal">
              Qty
            </th>
            <th scope="col" className="pb-2 text-right font-normal">
              Amount (KES)
            </th>
          </tr>
        </thead>
        <tbody>
          {props.items.map((item, index) => (
            <tr key={index} className="border-t border-line align-top">
              <td className="py-2 pr-2 wrap-anywhere">{item.description || "—"}</td>
              <td className="py-2 text-right tabular-nums">
                {item.quantity ? displayQuantity(item.quantity) : "—"}
              </td>
              <td className="py-2 text-right tabular-nums">
                {totals?.lineTotals[index] ? formatAmount(totals.lineTotals[index]) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-4 ml-auto grid max-w-64 grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 border-t border-line pt-4 tabular-nums">
        <dt className="text-sub">Subtotal</dt>
        <dd className="text-right">{totals ? formatAmount(totals.subtotal) : "—"}</dd>
        {props.discountLabel && (
          <>
            <dt className="text-sub">{props.discountLabel}</dt>
            <dd className="text-right">−{totals ? formatAmount(totals.discountAmount) : "—"}</dd>
          </>
        )}
        {props.taxRate && (
          <>
            <dt className="text-sub">Tax ({props.taxRate}%)</dt>
            <dd className="text-right">{totals ? formatAmount(totals.taxAmount) : "—"}</dd>
          </>
        )}
        <dt className="border-t border-line pt-2 font-semibold">Invoice total</dt>
        <dd className="border-t border-line pt-2 text-right font-semibold">
          {totals ? formatAmount(totals.total) : "—"}
        </dd>
        <dt className="text-sub">Payments received</dt>
        <dd className="text-right">{formatAmount(props.paymentsReceived ?? "0")}</dd>
        <dt className="font-semibold">Balance due</dt>
        <dd className="text-right font-semibold">
          KES{" "}
          {props.balanceDue !== undefined
            ? formatAmount(props.balanceDue)
            : totals
              ? formatAmount(totals.total)
              : "—"}
        </dd>
      </dl>

      {(props.paymentInstructions || props.notes) && (
        <div className="mt-6 grid gap-4 border-t border-line pt-4 text-sm">
          {props.paymentInstructions && (
            <div>
              <p className="text-xs text-sub">Payment instructions</p>
              <p className="whitespace-pre-line">{props.paymentInstructions}</p>
            </div>
          )}
          {props.notes && (
            <div>
              <p className="text-xs text-sub">Notes</p>
              <p className="whitespace-pre-line">{props.notes}</p>
            </div>
          )}
        </div>
      )}

      {props.showBranding && (
        <p className="mt-6 border-t border-line pt-3 text-center text-xs text-sub">
          Created with TallyNest
        </p>
      )}
    </article>
  );
}
