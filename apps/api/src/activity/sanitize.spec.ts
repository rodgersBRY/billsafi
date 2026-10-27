import { schema } from "@billsafi/db";
import {
  failedSignInMethods,
  failedSignInReasons,
  jobNames,
  operationFailureKinds,
  productEventNames,
} from "@billsafi/contracts";
import { errorClassOf, sanitizeMessage } from "./sanitize.js";

describe("sanitizeMessage", () => {
  it("hides addresses, links, phone numbers and tokens", () => {
    const text =
      "Cannot send to alice@example.test via https://mail.example.test/x?t=1 for +254 712 345 678 token abcdefghijklmnopqrstuvwx1234";
    expect(sanitizeMessage(text)).toBe(
      "Cannot send to [email] via [link] for [number] token [token]",
    );
  });

  it("keeps ordinary text and caps the length at 300", () => {
    expect(sanitizeMessage("connect ECONNREFUSED")).toBe("connect ECONNREFUSED");
    expect(sanitizeMessage("x ".repeat(400))).toHaveLength(300);
  });
});

describe("sanitizeMessage with real error strings", () => {
  const SECRET = "hunter2-secret";
  const cases: [string, string, string[]][] = [
    [
      "a Drizzle query error",
      `Failed query: insert into "users" ("email", "name") values ($1, $2)\nparams: bob@example.test,${SECRET}`,
      ["bob@example.test", SECRET, "insert", "users", "params"],
    ],
    ["a pg invalid input error", `invalid input syntax for type uuid: "${SECRET}"`, [SECRET]],
    [
      "a pg unique violation",
      'duplicate key value violates unique constraint "users_email_key"\nKey (email)=(bob@example.test) already exists.',
      ["bob@example.test", "users_email_key"],
    ],
    [
      "an SMTP rejection",
      "Can't send mail - all recipients were rejected: 550 5.1.1 <bob@example.test>: Recipient address rejected: User unknown in virtual mailbox table",
      ["bob@example.test"],
    ],
    [
      "an SMTP envelope error",
      "Command failed: RCPT TO:<bob@example.test> 550 mailbox unavailable for bob@example.test",
      ["bob@example.test"],
    ],
    [
      "a Better Auth error",
      `Reset link https://billsafi.test/reset-password/abcdefghijklmnopqrstuvwxyz012345?token=abcdefghijklmnopqrstuvwxyz012345 could not be sent to bob@example.test, user '${SECRET}'`,
      ["bob@example.test", "abcdefghijklmnopqrstuvwxyz012345", SECRET, "https://"],
    ],
  ];

  it.each(cases)("%s keeps nothing sensitive", (_name, text, forbidden) => {
    const cleaned = sanitizeMessage(text);
    for (const part of forbidden) expect(cleaned).not.toContain(part);
    expect(cleaned.length).toBeGreaterThan(0);
  });

  it("turns a Failed query message into one fixed sentence", () => {
    expect(sanitizeMessage("Failed query: select 1\nparams: 1")).toBe("Database query failed");
  });
});

describe("errorClassOf", () => {
  it("uses the class name and never the message", () => {
    expect(errorClassOf(new TypeError("secret"))).toBe("TypeError");
    expect(errorClassOf("plain string")).toBe("string");
  });
});

const {
  FAILED_SIGN_IN_METHODS,
  FAILED_SIGN_IN_REASONS,
  JOB_NAMES,
  OPERATION_FAILURE_KINDS,
  PRODUCT_EVENT_NAMES,
} = schema;

describe("the database check lists", () => {
  it("match the contracts, so an event the API writes is never refused by the table", () => {
    expect([...PRODUCT_EVENT_NAMES]).toEqual(
      [...productEventNames].sort(byDb(PRODUCT_EVENT_NAMES)),
    );
    expect([...OPERATION_FAILURE_KINDS]).toEqual([...operationFailureKinds]);
    expect([...JOB_NAMES]).toEqual([...jobNames]);
    expect([...FAILED_SIGN_IN_METHODS]).toEqual([...failedSignInMethods]);
    expect([...FAILED_SIGN_IN_REASONS]).toEqual([...failedSignInReasons]);
  });
});

function byDb(order: readonly string[]) {
  return (a: string, b: string) => order.indexOf(a) - order.indexOf(b);
}
