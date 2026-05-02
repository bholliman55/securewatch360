import { isIP } from "node:net";

/**
 * SSRF-safe checks for user-supplied external intelligence / discovery targets.
 * Handles IPv4-mapped IPv6 (::ffff:a.b.c.d) and RFC 6598 CGNAT (100.64.0.0/10).
 */

function stripZoneId(hostname: string): string {
  const i = hostname.indexOf("%");
  return i === -1 ? hostname : hostname.slice(0, i);
}

export function parseIpv4Octets(value: string): [number, number, number, number] | null {
  const m = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1, 5).map((x) => Number(x));
  if (parts.some((n) => n < 0 || n > 255 || !Number.isInteger(n))) return null;
  return [parts[0], parts[1], parts[2], parts[3]];
}

/**
 * RFC1918, loopback, link-local, CGNAT (RFC 6598), multicast, and reserved IPv4.
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

function isReservedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().trim();
  if (h === "localhost") return true;
  return (
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    h.endsWith(".test") ||
    h.endsWith(".example")
  );
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
  if (h.startsWith("::ffff:")) return false;

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
 * True when the hostname must not be used for external discovery / OSINT triggers.
 * - Blocks reserved hostnames (.internal, localhost, …).
 * - Blocks any dotted IPv4 literal and any ::ffff:IPv4 mapped form (fixes SSRF via ::ffff:10.0.0.1).
 * - Blocks non-public IPv6 literals (loopback, ULA, link-local, multicast, documentation).
 * - Blocks malformed colon strings that are not valid IPs.
 */
export function isBlockedExternalTarget(hostname: string): boolean {
  const h = stripZoneId(hostname.trim());
  if (!h) return true;

  const lower = h.toLowerCase();

  if (isReservedHostname(lower)) return true;

  if (lower.startsWith("::ffff:")) {
    return true;
  }

  const family = isIP(lower);
  if (family === 4) {
    return true;
  }

  if (family === 6) {
    return isBlockedIpv6Literal(lower);
  }

  if (lower.includes(":")) {
    return true;
  }

  return false;
}
