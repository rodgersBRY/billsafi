import { z } from "zod";

/** Tours and dismissible guides tracked per account (D057). */
export const PRODUCT_TOUR_KEYS = ["first-run", "getting-started-checklist"] as const;
export const productTourKeySchema = z.enum(PRODUCT_TOUR_KEYS);
export type ProductTourKey = z.infer<typeof productTourKeySchema>;

/** Raise a version to show that tour again to every account. */
export const PRODUCT_TOUR_VERSIONS: Record<ProductTourKey, number> = {
  "first-run": 1,
  "getting-started-checklist": 1,
};

export const productTourStatusSchema = z.enum(["completed", "dismissed"]);
export type ProductTourStatus = z.infer<typeof productTourStatusSchema>;

export const saveProductTourSchema = z.object({
  version: z.number().int().min(1),
  status: productTourStatusSchema,
  lastStep: z.number().int().min(0).max(50).default(0),
});
export type SaveProductTourInput = z.input<typeof saveProductTourSchema>;
export type SaveProductTour = z.output<typeof saveProductTourSchema>;

export interface ProductTourState {
  key: ProductTourKey;
  version: number;
  status: ProductTourStatus;
  lastStep: number;
  updatedAt: string;
}

/** True when the account has not finished or skipped the current version. */
export function shouldShowTour(states: ProductTourState[], key: ProductTourKey): boolean {
  const saved = states.find((state) => state.key === key);
  return !saved || saved.version < PRODUCT_TOUR_VERSIONS[key];
}

/** Account-wide first steps; each is done when any business has done it. */
export interface GettingStarted {
  addClient: boolean;
  createInvoice: boolean;
  shareInvoice: boolean;
  paymentInstructions: boolean;
  recordPayment: boolean;
}
