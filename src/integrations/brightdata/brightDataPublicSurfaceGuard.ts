/**
 * Ensures Bright Data MCP is only used against public internet targets — never private/internal systems.
 */

const PRIVATE_IPV4_RANGES: Array<{ prefix: string; bits: number }> = [
  { prefix: "10.", bits: 8 },
  { prefix: "172.16.", bits: 12 },
  { prefix: "172.17.", bits: 12 },
  { prefix: "172.18.", bits: 12 },
  { prefix: "172.19.", bits: 12 },
  { prefix: "172.20.", bits: 12 },
  { prefix: "172.21.", bits: 12 },
  { prefix: "172.22.", bits: 12 },
  { prefix: "172.23.", bits: 12 },
  { prefix: "172.24.", bits: 12 },
  { prefix: "172.25.", bits: 12 },
  { prefix: "172.26.", bits: 12 },
  { prefix: "172.27.", bits: 12 },
  { prefix: "172.28.", bits: 12 },
  { prefix: "172.29.", bits: 12 },
  { prefix: "172.30.", bits: 12 },
  { prefix: "172.31.", bits: 12 },
  { prefix: "192.168.", bits: 16 },
  { prefix: "127.", bits: 8 },
  { prefix: "0.", bits: 8 },
  { prefix: "169.254.", bits: 16 },
];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "metadata.google.internal",
  "kubernetes.default",
]);

const BLOCKED_HOST_SUFFIXES = [".local", ".internal", ".corp", ".lan", ".home", ".localdomain"];

export class BrightDataPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrightDataPolicyError";
  }
}

function ipv4InPrivateRange(host: string): boolean {
  const h = host.toLowerCase();
  for (const { prefix } of PRIVATE_IPV4_RANGES) {
    if (h.startsWith(prefix)) return true;
  }
  return false;
}

function hostnameBlocked(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  for (const suf of BLOCKED_HOST_SUFFIXES) {
    if (h.endsWith(suf)) return true;
  }
  return false;
}

/**
 * Throws if the URL must not be fetched via Bright Data (non-http(s), loopback, RFC1918, obvious internal names).
 */
export function assertPublicInternetTargetUrl(rawUrl: string): void {
  const trimmed = rawUrl.trim();
  if (!trimmed) throw new BrightDataPolicyError("URL is empty");

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new BrightDataPolicyError("Invalid URL");
  }

  const protocol = url.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    throw new BrightDataPolicyError(`Disallowed URL scheme for Bright Data: ${url.protocol}`);
  }

  const host = url.hostname;
  if (!host) throw new BrightDataPolicyError("Missing hostname");

  if (hostnameBlocked(host)) {
    throw new BrightDataPolicyError(`Hostname is not allowed for public Bright Data collection: ${host}`);
  }

  if (url.hostname.includes(":") && !url.hostname.startsWith("[")) {
    // bare IPv6 — conservative block of obvious ::1
    if (host === "::1") throw new BrightDataPolicyError("IPv6 loopback is not allowed");
  }

  // IPv4 literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    if (ipv4InPrivateRange(host)) {
      throw new BrightDataPolicyError("Private or non-routable IPv4 addresses cannot be scanned via Bright Data");
    }
  }
}

/** Blocklist patterns inside free-text queries that indicate internal targeting. */
const SUSPICIOUS_QUERY_SNIPPETS = [
  /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
  /\b192\.168\.\d{1,3}\.\d{1,3}\b/,
  /\b172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/,
  /\b127\.0\.0\.1\b/i,
  /\blocalhost\b/i,
  /\.local\b/i,
  /\.internal\b/i,
];

export function assertPublicOsintSearchQuery(query: string): void {
  const q = query.trim();
  if (!q) throw new BrightDataPolicyError("Search query is empty");
  for (const re of SUSPICIOUS_QUERY_SNIPPETS) {
    if (re.test(q)) {
      throw new BrightDataPolicyError("Search query appears to reference private or internal systems");
    }
  }
}
