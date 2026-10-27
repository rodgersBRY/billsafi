/*
 * How admin pages show a session: a short device summary instead of the raw user agent,
 * and a truncated IP address. Enough to spot "a new device in another network" without
 * keeping more personal data on screen than needed.
 */

export interface DeviceSummary {
  browser: string;
  os: string;
}

const UNKNOWN = "Unknown";

/** Checked in order: Edge and Opera also say "Chrome", Chrome also says "Safari". */
const BROWSERS: [name: string, pattern: RegExp][] = [
  ["Edge", /\bEdg(?:e|A|iOS)?\/(\d+)/],
  ["Opera", /\b(?:OPR|Opera)\/(\d+)/],
  ["Samsung Internet", /\bSamsungBrowser\/(\d+)/],
  ["Firefox", /\b(?:Firefox|FxiOS)\/(\d+)/],
  ["Chrome", /\b(?:Chrome|CriOS)\/(\d+)/],
  ["Safari", /\bVersion\/(\d+)[\d.]* (?:Mobile\/\S+ )?Safari\//],
  ["curl", /^curl\/(\d+)/],
];

/** iOS before macOS (iPads say "like Mac OS X"), Android before Linux. */
const SYSTEMS: [name: string, pattern: RegExp][] = [
  ["iOS", /\b(?:iPhone|iPad|iPod)\b/],
  ["Android", /\bAndroid\b/],
  ["Windows", /\bWindows\b/],
  ["ChromeOS", /\bCrOS\b/],
  ["macOS", /\bMac OS X\b|\bMacintosh\b/],
  ["Linux", /\bLinux\b/],
];

/** "Chrome 130" on "macOS" from a user agent string; "Unknown" for anything unrecognised. */
export function summariseUserAgent(userAgent: string | null | undefined): DeviceSummary {
  if (!userAgent) return { browser: UNKNOWN, os: UNKNOWN };
  let browser = UNKNOWN;
  for (const [name, pattern] of BROWSERS) {
    const match = pattern.exec(userAgent);
    if (match) {
      browser = `${name} ${match[1]}`;
      break;
    }
  }
  const os = SYSTEMS.find(([, pattern]) => pattern.test(userAgent))?.[0] ?? UNKNOWN;
  return { browser, os };
}

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function maskIpv4(ip: string): string | null {
  const match = IPV4.exec(ip);
  if (!match || match.slice(1).some((part) => Number(part) > 255)) return null;
  return `${match[1]}.${match[2]}.${match[3]}.0/24`;
}

/** The eight groups of an IPv6 address, or null when it does not parse. */
function ipv6Groups(ip: string): string[] | null {
  if (!/^[0-9a-f:]+$/i.test(ip) || ip.split("::").length > 2) return null;
  const [head, tail] = ip.includes("::") ? ip.split("::") : [ip, undefined];
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const missing = 8 - left.length - right.length;
  if (tail === undefined ? missing !== 0 : missing < 1) return null;
  const groups = [...left, ...Array<string>(missing).fill("0"), ...right];
  if (groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))) return null;
  return groups.map((group) => group.toLowerCase().replace(/^0+(?=.)/, ""));
}

/**
 * The network part only: 203.0.113.0/24 for IPv4, 2001:db8:85a3::/48 for IPv6.
 * IPv4-mapped IPv6 (::ffff:203.0.113.7) is shown as IPv4. Null when absent or unreadable.
 */
export function maskIpAddress(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const address = ip.trim().replace(/%.*$/, "");
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address);
  if (mapped) return maskIpv4(mapped[1]!);
  if (address.includes(".")) return maskIpv4(address);
  const groups = ipv6Groups(address);
  return groups ? `${groups.slice(0, 3).join(":")}::/48` : null;
}
