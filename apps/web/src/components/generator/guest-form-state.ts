import type { BusinessProfileType } from "@billsafi/contracts";
import type { Adjustments } from "@/components/invoices/adjustments-fields";
import { type EditorItem, newItem } from "@/components/invoices/editor-items";
import type { GuestDraft } from "./guest-draft";

export interface GuestBusiness {
  profileType: BusinessProfileType;
  displayName: string;
  contactEmail: string;
  phone: string;
  address: string;
  kraPin: string;
}

export interface GuestClient {
  name: string;
  phone: string;
  email: string;
  companyName: string;
}

/** Everything the generator form edits, as plain strings so inputs stay controlled. */
export interface GuestForm {
  business: GuestBusiness;
  client: GuestClient;
  issueDate: string;
  dueDate: string;
  items: EditorItem[];
  adjustments: Adjustments;
  paymentInstructions: string;
  notes: string;
}

export type Errors = Record<string, string>;

export function emptyGuestForm(): GuestForm {
  return {
    business: {
      profileType: "individual",
      displayName: "",
      contactEmail: "",
      phone: "",
      address: "",
      kraPin: "",
    },
    client: { name: "", phone: "", email: "", companyName: "" },
    issueDate: "",
    dueDate: "",
    items: [newItem()],
    adjustments: {
      discountOn: false,
      discountType: "fixed",
      discountValue: "",
      taxOn: false,
      taxRate: "16",
    },
    paymentInstructions: "",
    notes: "",
  };
}

export function discountOf({ adjustments }: GuestForm) {
  return adjustments.discountOn
    ? { type: adjustments.discountType, value: adjustments.discountValue }
    : null;
}

export function taxRateOf({ adjustments }: GuestForm) {
  return adjustments.taxOn ? adjustments.taxRate : null;
}

/** The import body, which is also what goes into browser storage. */
export function toGuestDraft(form: GuestForm): GuestDraft {
  return {
    business: { ...form.business },
    client: { ...form.client },
    invoice: {
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      items: form.items.map(({ description, quantity, unitPrice }) => ({
        description,
        quantity,
        unitPrice,
      })),
      discount: discountOf(form),
      taxRate: taxRateOf(form),
      paymentInstructions: form.paymentInstructions,
      notes: form.notes,
    },
  };
}

const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : typeof value === "number" ? String(value) : fallback;

/**
 * Stored drafts may be half finished or from an older page, so every field is
 * merged over the empty defaults and nulls become "".
 */
export function fromGuestDraft(draft: GuestDraft): GuestForm {
  const base = emptyGuestForm();
  const { business, client, invoice } = draft;
  const discount = invoice.discount;
  return {
    business: {
      profileType: business.profileType === "business" ? "business" : "individual",
      displayName: text(business.displayName),
      contactEmail: text(business.contactEmail),
      phone: text(business.phone),
      address: text(business.address),
      kraPin: text(business.kraPin),
    },
    client: {
      name: text(client.name),
      phone: text(client.phone),
      email: text(client.email),
      companyName: text(client.companyName),
    },
    issueDate: text(invoice.issueDate),
    dueDate: text(invoice.dueDate),
    items: invoice.items.map((item) =>
      newItem({
        description: text(item?.description),
        quantity: text(item?.quantity, "1"),
        unitPrice: text(item?.unitPrice),
      }),
    ),
    adjustments: {
      discountOn: Boolean(discount),
      discountType: discount?.type === "percentage" ? "percentage" : "fixed",
      discountValue: text(discount?.value),
      taxOn: invoice.taxRate != null,
      taxRate: text(invoice.taxRate, base.adjustments.taxRate),
    },
    paymentInstructions: text(invoice.paymentInstructions),
    notes: text(invoice.notes),
  };
}
