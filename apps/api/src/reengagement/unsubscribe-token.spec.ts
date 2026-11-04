import { unsubscribeToken, verifyUnsubscribeToken } from "./unsubscribe-token.js";

const secret = "a-test-secret-that-is-at-least-32-characters";
const userId = "0199f0a8-1c2d-7e3f-8a4b-5c6d7e8f9a0b";

describe("unsubscribe tokens", () => {
  it("round-trips the user ID", () => {
    expect(verifyUnsubscribeToken(secret, unsubscribeToken(secret, userId))).toBe(userId);
  });

  it("rejects a token signed with another secret or for another user", () => {
    const other = unsubscribeToken(`${secret}-other`, userId);
    expect(verifyUnsubscribeToken(secret, other)).toBeNull();
    const [, sig] = unsubscribeToken(secret, userId).split(".");
    expect(
      verifyUnsubscribeToken(secret, `0199f0a8-1c2d-7e3f-8a4b-5c6d7e8f9a0c.${sig}`),
    ).toBeNull();
  });

  it("rejects malformed tokens", () => {
    for (const token of ["", "abc", `${userId}.`, `not-a-uuid.sig`, `${userId}.a.b`]) {
      expect(verifyUnsubscribeToken(secret, token)).toBeNull();
    }
  });
});
