import type {
  MpesaProvider,
  StkPushAccepted,
  StkPushRequest,
  StkQueryResult,
} from "./mpesa.provider.js";

interface FakeRequest extends StkPushRequest {
  at: number;
  outcome: StkQueryResult | null;
}

/**
 * Stands in for Safaricom in tests and local work without Daraja keys (D051).
 * By default a request succeeds a few seconds after it is sent, or fails when
 * the phone number ends in 0000, so the checkout can be tried end to end.
 */
export class FakeMpesaProvider implements MpesaProvider {
  readonly name = "fake";
  readonly requests = new Map<string, FakeRequest>();

  constructor(private readonly options: { autoSettleMs: number | null } = { autoSettleMs: 5000 }) {}

  async stkPush(request: StkPushRequest): Promise<StkPushAccepted> {
    const checkoutRequestId = `ws_CO_FAKE_${crypto.randomUUID()}`;
    this.requests.set(checkoutRequestId, { ...request, at: Date.now(), outcome: null });
    return { merchantRequestId: `FAKE-${crypto.randomUUID()}`, checkoutRequestId };
  }

  async query(checkoutRequestId: string): Promise<StkQueryResult> {
    const request = this.requests.get(checkoutRequestId);
    if (!request) {
      return { state: "failed", resultCode: "2001", resultDescription: "Unknown request" };
    }
    if (request.outcome) return request.outcome;
    const { autoSettleMs } = this.options;
    if (autoSettleMs === null || Date.now() - request.at < autoSettleMs)
      return { state: "pending" };
    return request.phone.endsWith("0000")
      ? { state: "failed", resultCode: "1032", resultDescription: "Request cancelled by user" }
      : { state: "succeeded", receipt: fakeReceipt() };
  }

  /** Fixes what the next status query reports, for tests. */
  settle(checkoutRequestId: string, outcome: StkQueryResult): void {
    const request = this.requests.get(checkoutRequestId);
    if (request) request.outcome = outcome;
  }

  last(): { checkoutRequestId: string; request: FakeRequest } | undefined {
    const entry = [...this.requests.entries()].at(-1);
    return entry && { checkoutRequestId: entry[0], request: entry[1] };
  }
}

export function fakeReceipt(): string {
  return `FK${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}
