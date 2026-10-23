import type { Database } from "@billsafi/db";

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Either the shared connection or a caller's open transaction. */
export type Executor = Database | Transaction;
