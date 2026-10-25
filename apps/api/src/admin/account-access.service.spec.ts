import type { AuthService } from "@thallesp/nestjs-better-auth";
import type { Auth } from "../auth/auth.js";
import { AccountAccessService } from "./account-access.service.js";

function serviceWith(deleteUserSessions: () => Promise<void>) {
  const adapter = {
    findUserById: vi.fn(async () => ({ id: "u1" })),
    updateUser: vi.fn(async () => ({})),
    deleteUserSessions: vi.fn(deleteUserSessions),
  };
  const auth = { instance: { $context: Promise.resolve({ internalAdapter: adapter }) } };
  return { adapter, service: new AccountAccessService(auth as unknown as AuthService<Auth>) };
}

describe("AccountAccessService.suspend", () => {
  it("bans before deleting sessions", async () => {
    const { adapter, service } = serviceWith(async () => {});
    await service.suspend("u1", "Fraud report");
    expect(adapter.updateUser).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ banned: true, banReason: "Fraud report" }),
    );
    expect(adapter.updateUser.mock.invocationCallOrder[0]).toBeLessThan(
      adapter.deleteUserSessions.mock.invocationCallOrder[0]!,
    );
  });

  it("retries a failed session deletion once", async () => {
    let calls = 0;
    const { adapter, service } = serviceWith(async () => {
      if (calls++ === 0) throw new Error("connection reset");
    });
    await service.suspend("u1", "Fraud report");
    expect(adapter.deleteUserSessions).toHaveBeenCalledTimes(2);
  });

  it("throws after a second failure, leaving the ban in place", async () => {
    const { adapter, service } = serviceWith(async () => {
      throw new Error("database down");
    });
    await expect(service.suspend("u1", "Fraud report")).rejects.toThrow("database down");
    expect(adapter.updateUser).toHaveBeenCalledOnce();
    expect(adapter.deleteUserSessions).toHaveBeenCalledTimes(2);
  });
});
