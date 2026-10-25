import { maskIpAddress, summariseUserAgent } from "./session-display.js";

describe("summariseUserAgent", () => {
  it.each([
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      { browser: "Chrome 130", os: "macOS" },
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.2849.68",
      { browser: "Edge 130", os: "Windows" },
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
      { browser: "Safari 18", os: "iOS" },
    ],
    [
      "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
      { browser: "Samsung Internet 26", os: "Android" },
    ],
    [
      "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
      { browser: "Firefox 132", os: "Linux" },
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/114.0.0.0",
      { browser: "Opera 114", os: "Windows" },
    ],
    ["curl/8.7.1", { browser: "curl 8", os: "Unknown" }],
  ])("reads %s", (userAgent, expected) => {
    expect(summariseUserAgent(userAgent)).toEqual(expected);
  });

  it("says Unknown for missing or unrecognised agents", () => {
    expect(summariseUserAgent(null)).toEqual({ browser: "Unknown", os: "Unknown" });
    expect(summariseUserAgent("node-superagent/3.8.3")).toEqual({
      browser: "Unknown",
      os: "Unknown",
    });
  });
});

describe("maskIpAddress", () => {
  it("keeps the /24 of an IPv4 address", () => {
    expect(maskIpAddress("203.0.113.45")).toBe("203.0.113.0/24");
    expect(maskIpAddress("::ffff:127.0.0.1")).toBe("127.0.0.0/24");
  });

  it("keeps the first three groups of an IPv6 address", () => {
    expect(maskIpAddress("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe("2001:db8:85a3::/48");
    expect(maskIpAddress("2001:db8::1")).toBe("2001:db8:0::/48");
    expect(maskIpAddress("::1")).toBe("0:0:0::/48");
    expect(maskIpAddress("fe80::1%en0")).toBe("fe80:0:0::/48");
  });

  it("returns null for missing or malformed addresses", () => {
    expect(maskIpAddress(null)).toBeNull();
    expect(maskIpAddress("")).toBeNull();
    expect(maskIpAddress("999.1.1.1")).toBeNull();
    expect(maskIpAddress("not-an-ip")).toBeNull();
    expect(maskIpAddress("1:2:3:4:5:6:7:8:9")).toBeNull();
    expect(maskIpAddress("1::2::3")).toBeNull();
  });
});
