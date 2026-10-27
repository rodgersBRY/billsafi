import { NotFoundException } from "@nestjs/common";
import type { DatabaseConnection } from "@billsafi/db";
import { AccountAccessService } from "./account-access.service.js";

/** A stand-in for Drizzle that records the order of writes. */
function fakeDatabase({ userExists = true } = {}) {
  const calls: string[] = [];
  const chain = (name: string, result: unknown) => {
    const node: Record<string, unknown> = {};
    for (const method of ["from", "set", "where", "returning"]) {
      node[method] = (value?: unknown) => {
        if (method === "set") calls.push(`${name}:${JSON.stringify(value)}`);
        return node;
      };
    }
    node.then = (resolve: (value: unknown) => void) => resolve(result);
    return node;
  };
  const executor = {
    select: () => chain("select", userExists ? [{ id: "u1" }] : []),
    update: () => {
      calls.push("update");
      return chain("update", []);
    },
    delete: () => {
      calls.push("delete");
      return chain("delete", [{ id: "s1" }, { id: "s2" }]);
    },
  };
  const db = {
    ...executor,
    transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work(executor)),
  };
  const service = new AccountAccessService({ db } as unknown as DatabaseConnection);
  return { calls, db, service };
}

describe("AccountAccessService", () => {
  it("bans, then deletes sessions, in one transaction", async () => {
    const { calls, db, service } = fakeDatabase();
    await service.suspend("u1", "Fraud report");
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(calls[0]).toBe("update");
    expect(calls[1]).toContain('"banned":true');
    expect(calls[1]).toContain('"banReason":"Fraud report"');
    expect(calls[2]).toBe("delete");
  });

  it("uses the caller's transaction when given one", async () => {
    const { db, service } = fakeDatabase();
    await service.reactivate("u1", db as never);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("clears the ban on reactivation", async () => {
    const { calls, service } = fakeDatabase();
    await service.reactivate("u1");
    expect(calls[1]).toContain('"banned":false');
    expect(calls[1]).toContain('"banReason":null');
    expect(calls).not.toContain("delete");
  });

  it("counts the sessions it revokes", async () => {
    const { service } = fakeDatabase();
    expect(await service.revokeSessions("u1")).toBe(2);
  });

  it("answers 404 for an unknown user and changes nothing", async () => {
    const { calls, service } = fakeDatabase({ userExists: false });
    await expect(service.suspend("nobody", "Fraud report")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(calls).toEqual([]);
  });
});
