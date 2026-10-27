import { isIP } from "node:net";

const PRIVATE_V4 = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
];

/** The hops Express trusts in app.setup.ts: loopback, link-local and private ranges. */
function isTrustedHop(ip: string): boolean {
  const address = ip.toLowerCase().replace(/^::ffff:/, "");
  if (isIP(address) === 4) return PRIVATE_V4.some((range) => range.test(address));
  if (isIP(address) === 6) {
    return (
      address === "::1" || address === "::" || /^f[cd]/.test(address) || /^fe[89ab]/.test(address)
    );
  }
  return false;
}

/**
 * The client address from an X-Forwarded-For value, by the rule Express uses for req.ip with
 * `trust proxy` set to private ranges: walk from the right, skip trusted proxies, and take
 * the first other address. Entries a visitor adds on the left can't change the answer
 * unless every hop to their right is a trusted proxy. Null when the header is empty.
 */
export function clientIpFromForwardedFor(header: string | null | undefined): string | null {
  const hops = (header ?? "")
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);
  for (let i = hops.length - 1; i >= 0; i--) {
    if (!isTrustedHop(hops[i]!)) return hops[i]!;
  }
  return hops[0] ?? null;
}

/** A rate limit key: IPv6 addresses share a limit per /64, so one host can't rotate addresses. */
export function rateLimitKey(ip: string | null | undefined): string {
  if (!ip) return "unknown";
  const address = ip.replace(/^::ffff:/i, "");
  if (isIP(address) !== 6) return address;
  const [head, tail] = address.includes("::") ? address.split("::") : [address, undefined];
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = [
    ...left,
    ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill("0"),
    ...right,
  ];
  return `${groups
    .slice(0, 4)
    .map((g) => g.toLowerCase().replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}
