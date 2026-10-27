"use client";

import { CalendarX, Coins, Crown, Gauge, Receipt } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCount, formatDay } from "../admin-format";
import { ConfirmActionDialog } from "../confirm-action-dialog";
import type { ActionContext } from "./action-context";
import { GrantDialog } from "./grant-dialog";
import { OverrideDialog } from "./override-dialog";
import { endProPreview } from "./preview";
import { RecordPaymentDialog } from "./record-payment-dialog";

type Open = "payment" | "pro" | "credits" | "override" | "end" | null;

interface SubscriptionActionsProps {
  context: ActionContext;
  /** The account is the signed-in admin's own: money, gifts and limits are refused. */
  isSelf: boolean;
}

const SELF_NOTE =
  "You can't record payments, gifts or limit changes for your own account. Ending Pro is allowed.";

/** The plan actions on the tenant's Subscription tab, each behind its own dialog. */
export function SubscriptionActions({ context, isSelf }: SubscriptionActionsProps) {
  const [open, setOpen] = useState<Open>(null);
  const noteId = useId();
  const endPro = endProPreview(context.pro);
  const close = () => setOpen(null);
  const selfProps = {
    disabled: isSelf,
    "aria-describedby": isSelf ? noteId : undefined,
  };
  const button = "min-h-11 md:min-h-0";

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className={button} {...selfProps} onClick={() => setOpen("payment")}>
          <Receipt aria-hidden className="size-4" />
          Record payment
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={button}
          {...selfProps}
          onClick={() => setOpen("pro")}
        >
          <Crown aria-hidden className="size-4" />
          Grant Pro months
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={button}
          {...selfProps}
          onClick={() => setOpen("credits")}
        >
          <Coins aria-hidden className="size-4" />
          Grant credits
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={button}
          {...selfProps}
          onClick={() => setOpen("override")}
        >
          <Gauge aria-hidden className="size-4" />
          Add limit override
        </Button>
        <Button
          type="button"
          variant="secondary"
          className={button}
          disabled={!endPro.allowed}
          aria-describedby={endPro.allowed ? undefined : `${noteId}-end`}
          onClick={() => setOpen("end")}
        >
          <CalendarX aria-hidden className="size-4 text-red-700 dark:text-red-300" />
          End Pro at month end
        </Button>
      </div>
      {isSelf && (
        <p id={noteId} className="mt-2 text-xs text-sub">
          {SELF_NOTE}
        </p>
      )}
      {!endPro.allowed && (
        <p id={`${noteId}-end`} className="mt-2 text-xs text-sub">
          End Pro is off: {endPro.reason}
        </p>
      )}
      {open === "payment" && <RecordPaymentDialog context={context} onClose={close} />}
      {(open === "pro" || open === "credits") && (
        <GrantDialog
          kind={open === "pro" ? "pro_months" : "invoice_credits"}
          context={context}
          onClose={close}
        />
      )}
      {open === "override" && <OverrideDialog context={context} onClose={close} />}
      {endPro.allowed && (
        <ConfirmActionDialog
          open={open === "end"}
          onClose={close}
          action={{
            title: "End Pro at the end of this month?",
            target: { name: context.target.name, detail: context.target.detail },
            impact: [
              `Pro ends on ${formatDay(endPro.endsOn.toISOString())}, the end of the current Pro month. Until then nothing changes.`,
              `The ${formatCount(endPro.droppedMonths)} later ${endPro.droppedMonths === 1 ? "month is" : "months are"} dropped. Nothing is refunded here; refunds are handled by hand.`,
              "Payments and gifts that ran past that date are marked as ended early.",
            ],
            confirmLabel: "End Pro at month end",
            path: `/admin/tenants/${encodeURIComponent(context.target.id)}/end-pro`,
            successMessage: `Pro now ends on ${formatDay(endPro.endsOn.toISOString())}.`,
            destructive: true,
          }}
        />
      )}
    </div>
  );
}
