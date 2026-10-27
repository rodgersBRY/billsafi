import { clientIpFromForwardedFor, rateLimitKey } from "./client-ip.js";

describe("clientIpFromForwardedFor", () => {
  it("takes the first address that is not a trusted proxy, from the right", () => {
    expect(clientIpFromForwardedFor("203.0.113.9")).toBe("203.0.113.9");
    expect(clientIpFromForwardedFor("203.0.113.9, 10.0.0.2")).toBe("203.0.113.9");
    expect(clientIpFromForwardedFor("203.0.113.9, 172.18.0.4, 127.0.0.1")).toBe("203.0.113.9");
  });

  it("ignores addresses a visitor puts on the left", () => {
    expect(clientIpFromForwardedFor("1.2.3.4, 203.0.113.9")).toBe("203.0.113.9");
    expect(clientIpFromForwardedFor("1.2.3.4, 5.6.7.8, 203.0.113.9, 10.1.1.1")).toBe("203.0.113.9");
  });

  it("falls back to the first entry when every hop is trusted, and to null when empty", () => {
    expect(clientIpFromForwardedFor("192.168.1.5, 10.0.0.2")).toBe("192.168.1.5");
    expect(clientIpFromForwardedFor("")).toBeNull();
    expect(clientIpFromForwardedFor(null)).toBeNull();
  });

  it("treats IPv6 loopback, unique local and link-local as trusted", () => {
    expect(clientIpFromForwardedFor("2001:db8::7, fd00::1, ::1, fe80::1")).toBe("2001:db8::7");
  });
});

describe("rateLimitKey", () => {
  it("keeps IPv4 as is and groups IPv6 by its /64", () => {
    expect(rateLimitKey("203.0.113.9")).toBe("203.0.113.9");
    expect(rateLimitKey("::ffff:203.0.113.9")).toBe("203.0.113.9");
    expect(rateLimitKey("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe("2001:db8:1:2::/64");
    expect(rateLimitKey("2001:db8:1:2::1")).toBe(rateLimitKey("2001:DB8:1:2:ffff::9"));
    expect(rateLimitKey(undefined)).toBe("unknown");
  });
});
