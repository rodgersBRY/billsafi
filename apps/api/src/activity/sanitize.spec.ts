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
