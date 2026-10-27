import { type ExecutionContext, HttpException } from "@nestjs/common";
import { AdminActionRateLimitGuard, SlidingWindowLimiter } from "./rate-limit.guard.js";

function contextFor(userId: string | undefined) {
  const headers: Record<string, string> = {};
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ user: userId ? { id: userId } : undefined }),
      getResponse: () => ({ setHeader: (name: string, value: string) => (headers[name] = value) }),
    }),
  } as unknown as ExecutionContext;
  return { context, headers };
}

describe("AdminActionRateLimitGuard", () => {
  let now: number;
  let guard: AdminActionRateLimitGuard;

  beforeEach(() => {
    now = 1_000_000;
    guard = new AdminActionRateLimitGuard(new SlidingWindowLimiter(10, 60_000, () => now));
  });

  function attempt(userId = "admin-a") {
    const { context, headers } = contextFor(userId);
    try {
      return { allowed: guard.canActivate(context), headers };
    } catch (error) {
      return { error: error as HttpException, headers };
    }
  }

  it("allows ten actions a minute and refuses the eleventh with 429", () => {
    for (let index = 0; index < 10; index++) {
      expect(attempt().allowed).toBe(true);
      now += 1_000;
    }
    const { error, headers } = attempt();
    expect(error?.getStatus()).toBe(429);
    expect(error?.getResponse()).toEqual({
      statusCode: 429,
      error: "Too Many Requests",
      message: expect.any(String),
    });
    // The first hit was at 1_000_000 and it is now 1_010_000: 50 seconds to go.
    expect(headers["Retry-After"]).toBe("50");
  });

  it("frees a slot once the oldest action leaves the window", () => {
    for (let index = 0; index < 10; index++) attempt();
    expect(attempt().error).toBeDefined();
    now += 60_000;
    expect(attempt().allowed).toBe(true);
  });

  it("counts each admin separately", () => {
    for (let index = 0; index < 10; index++) attempt("admin-a");
    expect(attempt("admin-a").error).toBeDefined();
    expect(attempt("admin-b").allowed).toBe(true);
  });

  it("refuses a request with no user", () => {
    expect(guard.canActivate(contextFor(undefined).context)).toBe(false);
  });
});
