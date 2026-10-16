import { Decimal } from "decimal.js";

/**
 * Isolated Decimal constructor for money. Rounding is half up, as adopted in
 * docs/database-model.md (10.125 becomes 10.13).
 */
export const Money = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Money = InstanceType<typeof Money>;

export type MoneyInput = string | number | Money;

export function money(value: MoneyInput): Money {
  return new Money(value);
}

/** Round a monetary amount to two decimal places, half up. */
export function roundMoney(value: MoneyInput): Money {
  return money(value).toDecimalPlaces(2, Money.ROUND_HALF_UP);
}

/** Format for storage in a PostgreSQL numeric column. */
export function toMoneyString(value: MoneyInput): string {
  return roundMoney(value).toFixed(2);
}
