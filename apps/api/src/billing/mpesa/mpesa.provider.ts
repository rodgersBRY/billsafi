export const MPESA_PROVIDER = Symbol("MPESA_PROVIDER");

export interface StkPushRequest {
  /** Whole shillings; M-Pesa does not accept cents. */
  amount: number;
  /** 2547XXXXXXXX or 2541XXXXXXXX, without the plus sign. */
  phone: string;
  accountReference: string;
  description: string;
}

export interface StkPushAccepted {
  merchantRequestId: string;
  checkoutRequestId: string;
}

export type StkQueryResult =
  | { state: "pending" }
  | { state: "succeeded"; receipt?: string }
  | { state: "failed"; resultCode: string; resultDescription: string };

/** The M-Pesa Express (STK Push) operations billing needs (D051). */
export interface MpesaProvider {
  readonly name: string;
  stkPush(request: StkPushRequest): Promise<StkPushAccepted>;
  query(checkoutRequestId: string): Promise<StkQueryResult>;
}

export class MpesaRequestError extends Error {}
