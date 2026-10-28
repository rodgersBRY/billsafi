import { vi } from "vitest";
import { RecordingMailer, ResendMailer } from "./mailer.js";

const message = {
  to: "user@example.test",
  subject: "Reset your password",
  text: "Reset link",
  html: "<p>Reset link</p>",
};
const context = { operation: "password_reset_email", accountId: "test-account" };

describe("Resend HTTPS delivery", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends both email bodies over HTTPS with server-side authentication", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email-id" })));
    vi.stubGlobal("fetch", request);
    await new ResendMailer("re_test", "BillSafi <no-reply@example.test>").send(message, context);
    const [url, options] = request.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer re_test");
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(options.body)).toEqual({
      ...message,
      from: "BillSafi <no-reply@example.test>",
      to: [message.to],
    });
  });

  it("records provider rejection without exposing the response body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("private recipient data", { status: 403 })),
    );
    const failure = vi.fn();
    const mailer = new RecordingMailer(new ResendMailer("re_test", "sender@example.test"), {
      failure,
    });
    await expect(mailer.send(message, context)).rejects.toThrow("HTTP 403");
    expect(failure).toHaveBeenCalledWith(
      "email",
      context.operation,
      expect.any(Error),
      context.accountId,
    );
    expect(failure.mock.calls[0]![2].message).not.toContain("private recipient data");
  });

  it("propagates network failures for existing failure recording", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Connection failed")));
    await expect(
      new ResendMailer("re_test", "sender@example.test").send(message, context),
    ).rejects.toThrow("Connection failed");
  });
});
