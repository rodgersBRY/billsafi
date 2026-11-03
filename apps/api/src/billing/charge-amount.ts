import { type MoneyInput, usdToKes } from "@billsafi/domain";
import type { Env } from "../config/env.js";

/**
 * The Daraja sandbox paybill (174379) takes real money from the phone that approves the
 * prompt, so sandbox checkouts charge KES 1 instead of the real price.
 */
export const SANDBOX_CHARGE_KES = "1.00";

/** KES to request over M-Pesa for a checkout; stored as the expected amount too. */
export function checkoutChargeKes(
  mpesaEnv: Env["MPESA_ENV"],
  priceUsd: MoneyInput,
  usdKesRate: MoneyInput,
): string {
  if (mpesaEnv === "sandbox") return SANDBOX_CHARGE_KES;
  return usdToKes(priceUsd, usdKesRate);
}
