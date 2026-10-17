/** Free: 10 invoices per Nairobi calendar month across all businesses (D019, D044). */
export const FREE_PLAN = { code: "free", invoiceLimit: 10 } as const;

/** Pro: KES 500 per anniversary month, 100 invoices per month (D020, D044). */
export const PRO_PLAN = { code: "pro", invoiceLimit: 100, price: "500.00" } as const;

/** Extra invoices used after the plan allowance; they do not expire (D051). */
export const CREDIT_PACK = { invoices: 50, price: "250.00" } as const;

/** Renewal reminders start this many days before paid access ends (D051). */
export const REMINDER_DAYS_BEFORE = 3;
