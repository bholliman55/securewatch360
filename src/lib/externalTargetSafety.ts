import { isIP } from "node:net";

/**
 * SSRF-safe checks for user-supplied external intelligence / discovery targets.
 * Aligns public-IPv4 allowlisting with merged main (#39); blocks RFC1918, CGNAT,
 * multicast, loops, IPv4-mapped SSRF chains, unsafe IPv6 literals, and pseudo-domains.
 */

function stripZoneId(hostname: string): string {
  const i = hostname.indexOf("%");
  return i === -1 ? hostname : hostname.slice(0, i);
}

const RESERVED_HOST_PATTERN =
  /^(localhost|.*\.local|.*\.internal|.*\.test|.*\.example)(:\d+)?$/i;

export function parseIpv4Octets(value: string): [number, number, number, number] | null {
  const m = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1, 5).map((x) => Number(x));
  if (parts.some((n) => n < 0 || n > 255 || !Number.isInteger(n))) return null;
  return [parts[0], parts[1], parts[2], parts[3]];
}

/**
 * RFC1918, loopback, CGNAT (RFC 6598), multicast, reserved IPv4, etc.
 */
export function isPrivateCgnatOrReservedIpv4(octets: [number, number, number, number]): boolean {
  const [a, b] = octets;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function ipv6FirstSegment(lower: string): string | null {
  if (lower.startsWith("::")) {
    const rest = lower.slice(2);
    if (!rest) return null;
    return rest.split(":")[0] || null;
  }
  return lower.split(":")[0] || null;
}

function isBlockedIpv6Literal(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "::1") return true;
  if (h.startsWith("ff")) return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true;
  if (h.startsWith("2001:db8")) return true;

  const head = ipv6FirstSegment(h);
  if (!head) return false;
  if (!/^[0-9a-f]{1,4}$/i.test(head)) return false;
  const v = parseInt(head, 16);
  if (Number.isNaN(v)) return false;
  if (v >= 0xfe80 && v <= 0xfebf) return true;
  return false;
}

/**
 * Normalize a URL hostname or bare domain for validation.
 */
export function normalizeDomain(raw: string): string {
  try {
    const withScheme = raw.startsWith("http") ? raw : `https://${raw}`;
    return new URL(withScheme).hostname.toLowerCase().trim();
  } catch {
    return raw.toLowerCase().trim();
  }
}

export function isBlockedExternalTarget(hostname: string): boolean {
  const h = stripZoneId(hostname.trim());
  if (!h) return true;

  const lower = h.toLowerCase();

  if (RESERVED_HOST_PATTERN.test(lower)) return true;

  if (lower.startsWith("::ffff:")) {
    const ipv4Tail = lower.slice(7);
    const octets = parseIpv4Octets(ipv4Tail);
    if (!octets) return true;
    return isPrivateCgnatOrReservedIpv4(octets);
  }

  const family = isIP(lower);
  if (family === 4) {
    const octets = parseIpv4Octets(lower);
    if (!octets) return true;
    return isPrivateCgnatOrReservedIpv4(octets);
  }

  if (family === 6) {
    return isBlockedIpv6Literal(lower);
  }

  if (lower.includes(":")) return true;

  return false;
}
