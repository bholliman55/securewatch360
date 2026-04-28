/**
 * Agent 6: Quantum Risk & Crypto Agility Module
 * Parser/normalizer adapter — converts existing SecureWatch360 scan results and
 * common external scanner formats into CryptoInventoryItem records.
 * Does NOT perform live scanning.
 */

import type { CryptoInventoryItem, CryptoUsageType, RawScanFinding } from "./types";
import { analyzeQuantumRisk, normalizeAlgorithmName } from "./quantumRiskEngine";

// ── Input Schemas ─────────────────────────────────────────────────────────────

/** Top-level input accepted by the scanner adapter. */
export interface CryptoScanInput {
  scanId?: string;
  clientId: string;
  /** One or more source payloads — mix formats freely. */
  sources: CryptoScanSource[];
}

export type CryptoScanSource =
  | { type: "supabase_findings"; findings: RawScanFinding[] }
  | { type: "nmap"; hosts: NmapHost[] }
  | { type: "ssllabs"; report: SslLabsReport }
  | { type: "manual"; assets: ManualAssetPayload[] };

// ── Nmap Input ────────────────────────────────────────────────────────────────

export interface NmapHost {
  hostname?: string;
  ip: string;
  ports?: NmapPort[];
}

export interface NmapPort {
  port: number;
  state?: string;
  service?: string;      // e.g. "ssl/http", "ssh", "smtp"
  protocol?: string;     // e.g. "tcp"
  scripts?: {
    "ssl-cert"?: string;           // raw PEM or subject line
    "ssl-enum-ciphers"?: string;   // cipher negotiation output
    "tls-version"?: string;
    "ssh-hostkey"?: string;        // e.g. "2048 RSA ..."
    [key: string]: string | undefined;
  };
  /** Pre-parsed cert metadata if available (e.g. from nmap XML parser). */
  tlsCert?: {
    subject?: string;
    issuer?: string;
    algorithm?: string;
    keyBits?: number;
    notAfter?: string;
  };
}

// ── SSL Labs Input ────────────────────────────────────────────────────────────

export interface SslLabsReport {
  host?: string;
  endpoints?: SslLabsEndpoint[];
}

export interface SslLabsEndpoint {
  ipAddress?: string;
  details?: {
    protocols?: Array<{ name?: string; version?: string }>;
    cert?: {
      subject?: string;
      issuerSubject?: string;
      keyAlg?: string;          // "RSA", "EC", "ECDSA"
      keyStrength?: number;     // bits
      notAfter?: number;        // Unix ms
      sigAlg?: string;
    };
    suites?: {
      list?: Array<{ name?: string }>;
    };
  };
}

// ── Manual Input ──────────────────────────────────────────────────────────────

export interface ManualAssetPayload {
  hostname?: string;
  ip?: string;
  assetType?: string;
  serviceName?: string;
  port?: number;
  protocol?: string;
  cryptoUsage?: CryptoUsageType;
  algorithm?: string;
  keyLength?: number;
  certificateSubject?: string;
  certificateIssuer?: string;
  certificateExpiration?: string;   // ISO 8601
  tlsVersion?: string;
  discoverySource?: string;
  vendorMetadata?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parses and normalises all source payloads into enriched CryptoInventoryItems.
 * Each item is passed through analyzeQuantumRisk() before being returned.
 */
export function normalizeCryptoInventory(input: CryptoScanInput): CryptoInventoryItem[] {
  const raw: CryptoInventoryItem[] = [];

  for (const source of input.sources) {
    switch (source.type) {
      case "supabase_findings":
        raw.push(...parseSupabaseFindings(source.findings, input.clientId, input.scanId));
        break;
      case "nmap":
        raw.push(...parseNmapHosts(source.hosts, input.clientId, input.scanId));
        break;
      case "ssllabs":
        raw.push(...parseSslLabsReport(source.report, input.clientId, input.scanId));
        break;
      case "manual":
        raw.push(...parseManualAssets(source.assets, input.clientId, input.scanId));
        break;
    }
  }

  return raw.map((item) => analyzeQuantumRisk(item));
}

// ── Supabase / SecureWatch360 Findings ────────────────────────────────────────

const CRYPTO_SIGNALS = [
  "crypto", "tls", "ssl", "certificate", "cipher", "algorithm",
  "rsa", "ecdsa", "ecdh", "ecc", "dsa", "aes", "sha", "md5",
  "key", "pki", "x.509", "jwt", "ssh", "pgp", "encryption", "quantum", "pqc",
];

function parseSupabaseFindings(
  findings: RawScanFinding[],
  clientId: string,
  scanId?: string,
): CryptoInventoryItem[] {
  return findings
    .filter((f) => isCryptoFinding(f))
    .map((f) => {
      const meta = (f.metadata ?? {}) as Record<string, unknown>;
      const algorithm = normalizeAlgorithmName(
        extractStr(meta, ["algorithm", "cipher_suite", "cipher", "key_type", "key_alg"]) ?? f.title,
      );

      return buildItem({
        clientId,
        scanId,
        assetId: f.findingId,
        assetHostname: extractStr(meta, ["hostname", "host", "fqdn"]),
        assetIp: extractStr(meta, ["ip", "ip_address", "remote_ip"]),
        assetType: extractStr(meta, ["asset_type", "resource_type"]),
        serviceName: extractStr(meta, ["service_name", "service", "product"]),
        port: extractNum(meta, ["port", "remote_port"]),
        protocol: extractStr(meta, ["protocol", "transport"]),
        cryptoUsage: deriveCryptoUsage(`${f.category} ${f.title}`),
        algorithm,
        keyLength: extractNum(meta, ["key_length", "key_size", "bits", "key_bits"]),
        certificateSubject: extractStr(meta, ["certificate_subject", "cert_subject", "subject"]),
        certificateIssuer: extractStr(meta, ["certificate_issuer", "cert_issuer", "issuer"]),
        certificateExpiration: extractStr(meta, ["certificate_expiration", "not_after", "expiry", "cert_expiration"]),
        tlsVersion: extractStr(meta, ["tls_version", "ssl_version", "protocol_version"]),
        discoverySource: extractStr(meta, ["scanner", "source"]) ?? "securewatch360",
        evidence: {
          findingId: f.findingId,
          findingTitle: f.title,
          findingSeverity: f.severity,
          rawMetadata: meta,
        },
      });
    });
}

// ── Nmap Hosts ────────────────────────────────────────────────────────────────

function parseNmapHosts(
  hosts: NmapHost[],
  clientId: string,
  scanId?: string,
): CryptoInventoryItem[] {
  const items: CryptoInventoryItem[] = [];

  for (const host of hosts) {
    for (const port of host.ports ?? []) {
      if (port.state === "closed" || port.state === "filtered") continue;

      // TLS certificate from parsed cert block
      if (port.tlsCert) {
        items.push(buildItem({
          clientId,
          scanId,
          assetHostname: host.hostname,
          assetIp: host.ip,
          assetType: deriveAssetType(port.service, port.port),
          serviceName: port.service,
          port: port.port,
          protocol: port.protocol ?? "tcp",
          cryptoUsage: deriveCryptoUsageFromPort(port.port, port.service),
          algorithm: normalizeAlgorithmName(port.tlsCert.algorithm ?? "RSA-2048"),
          keyLength: port.tlsCert.keyBits,
          certificateSubject: port.tlsCert.subject,
          certificateIssuer: port.tlsCert.issuer,
          certificateExpiration: port.tlsCert.notAfter,
          tlsVersion: extractTlsVersionFromNmap(port.scripts),
          discoverySource: "nmap",
          evidence: { nmapScripts: port.scripts },
        }));
        continue;
      }

      // TLS certificate from raw ssl-cert script output
      if (port.scripts?.["ssl-cert"]) {
        const parsed = parseNmapSslCert(port.scripts["ssl-cert"]);
        items.push(buildItem({
          clientId,
          scanId,
          assetHostname: host.hostname,
          assetIp: host.ip,
          assetType: deriveAssetType(port.service, port.port),
          serviceName: port.service,
          port: port.port,
          protocol: port.protocol ?? "tcp",
          cryptoUsage: deriveCryptoUsageFromPort(port.port, port.service),
          algorithm: normalizeAlgorithmName(parsed.algorithm ?? "RSA-2048"),
          keyLength: parsed.keyBits,
          certificateSubject: parsed.subject,
          certificateIssuer: parsed.issuer,
          certificateExpiration: parsed.notAfter,
          tlsVersion: extractTlsVersionFromNmap(port.scripts),
          discoverySource: "nmap",
          evidence: { rawSslCert: port.scripts["ssl-cert"], nmapScripts: port.scripts },
        }));
        continue;
      }

      // SSH host key from ssh-hostkey script
      if (port.scripts?.["ssh-hostkey"] || (port.service?.includes("ssh") && port.port === 22)) {
        const sshKey = parseNmapSshHostKey(port.scripts?.["ssh-hostkey"]);
        items.push(buildItem({
          clientId,
          scanId,
          assetHostname: host.hostname,
          assetIp: host.ip,
          assetType: "ssh_server",
          serviceName: "SSH",
          port: port.port,
          protocol: "tcp",
          cryptoUsage: "ssh",
          algorithm: normalizeAlgorithmName(sshKey.algorithm ?? "RSA-2048"),
          keyLength: sshKey.keyBits,
          discoverySource: "nmap",
          evidence: { sshHostKey: port.scripts?.["ssh-hostkey"] },
        }));
      }
    }
  }

  return items;
}

// ── SSL Labs ──────────────────────────────────────────────────────────────────

function parseSslLabsReport(
  report: SslLabsReport,
  clientId: string,
  scanId?: string,
): CryptoInventoryItem[] {
  const items: CryptoInventoryItem[] = [];

  for (const endpoint of report.endpoints ?? []) {
    const cert = endpoint.details?.cert;
    const protocols = endpoint.details?.protocols ?? [];

    const topProtocol = [...protocols].sort((a, b) =>
      parseFloat(b.version ?? "0") - parseFloat(a.version ?? "0"),
    )[0];

    const tlsVersion = topProtocol
      ? `${topProtocol.name ?? "TLS"}v${topProtocol.version ?? ""}`
      : undefined;

    const algorithm = cert?.keyAlg
      ? normalizeAlgorithmName(
          cert.keyAlg === "EC" || cert.keyAlg === "ECDSA"
            ? `ECDSA-P${cert.keyStrength ?? 256}`
            : `${cert.keyAlg}-${cert.keyStrength ?? 2048}`,
        )
      : "RSA-2048";

    const certExpiration = cert?.notAfter
      ? new Date(cert.notAfter).toISOString()
      : undefined;

    items.push(buildItem({
      clientId,
      scanId,
      assetHostname: report.host,
      assetIp: endpoint.ipAddress,
      assetType: "public_web_app",
      serviceName: "HTTPS",
      port: 443,
      protocol: "tcp",
      cryptoUsage: "tls",
      algorithm,
      keyLength: cert?.keyStrength,
      certificateSubject: cert?.subject,
      certificateIssuer: cert?.issuerSubject,
      certificateExpiration: certExpiration,
      tlsVersion,
      discoverySource: "ssllabs",
      evidence: { sslLabsCert: cert, protocols },
    }));
  }

  return items;
}

// ── Manual Payloads ───────────────────────────────────────────────────────────

function parseManualAssets(
  assets: ManualAssetPayload[],
  clientId: string,
  scanId?: string,
): CryptoInventoryItem[] {
  return assets.map((asset) =>
    buildItem({
      clientId,
      scanId,
      assetHostname: asset.hostname,
      assetIp: asset.ip,
      assetType: asset.assetType,
      serviceName: asset.serviceName,
      port: asset.port,
      protocol: asset.protocol,
      cryptoUsage: asset.cryptoUsage ?? deriveCryptoUsage(`${asset.serviceName ?? ""} ${asset.assetType ?? ""}`),
      algorithm: normalizeAlgorithmName(asset.algorithm ?? "unknown"),
      keyLength: asset.keyLength,
      certificateSubject: asset.certificateSubject,
      certificateIssuer: asset.certificateIssuer,
      certificateExpiration: asset.certificateExpiration,
      tlsVersion: asset.tlsVersion,
      discoverySource: asset.discoverySource ?? "manual",
      evidence: {
        ...(asset.evidence ?? {}),
        vendorMetadata: asset.vendorMetadata,
      },
    }),
  );
}

// ── Nmap Parsing Helpers ──────────────────────────────────────────────────────

function parseNmapSslCert(raw: string): {
  subject?: string; issuer?: string; algorithm?: string; keyBits?: number; notAfter?: string;
} {
  const result: ReturnType<typeof parseNmapSslCert> = {};

  const subjectMatch = raw.match(/Subject:\s*([^\n]+)/i);
  if (subjectMatch) result.subject = subjectMatch[1].trim();

  const issuerMatch = raw.match(/Issuer:\s*([^\n]+)/i);
  if (issuerMatch) result.issuer = issuerMatch[1].trim();

  // "Public Key type: rsa" or "Public-Key: (2048 bit)"
  const algMatch = raw.match(/Public Key type:\s*(\w+)/i);
  if (algMatch) result.algorithm = algMatch[1].toUpperCase();

  const bitsMatch = raw.match(/\((\d+)\s*bit\)/i);
  if (bitsMatch) result.keyBits = parseInt(bitsMatch[1], 10);

  // "Not valid after:  2025-12-31T00:00:00"
  const expiryMatch = raw.match(/Not valid after:\s*([^\n]+)/i);
  if (expiryMatch) result.notAfter = expiryMatch[1].trim();

  return result;
}

function parseNmapSshHostKey(raw: string | undefined): { algorithm?: string; keyBits?: number } {
  if (!raw) return {};
  // "2048 RSA SHA256:..." or "256 ED25519 ..."
  const match = raw.match(/(\d+)\s+(RSA|ECDSA|DSA|ED25519|FALCON|ML-DSA)/i);
  if (match) {
    return { keyBits: parseInt(match[1], 10), algorithm: match[2].toUpperCase() };
  }
  return {};
}

function extractTlsVersionFromNmap(scripts?: Record<string, string | undefined>): string | undefined {
  if (!scripts) return undefined;

  const tlsScript = scripts["tls-version"] ?? scripts["ssl-enum-ciphers"] ?? "";
  const match = tlsScript.match(/TLSv?(\d+\.\d+)/i);
  if (match) return `TLSv${match[1]}`;

  // ssl-cert output sometimes contains "SSLv3" or "TLSv1.2"
  const sslCert = scripts["ssl-cert"] ?? "";
  const sslMatch = sslCert.match(/(TLSv?[\d.]+|SSLv[\d.]+)/i);
  if (sslMatch) return sslMatch[1];

  return undefined;
}

function deriveAssetType(service?: string, port?: number): string {
  if (!service && !port) return "unknown";
  const s = (service ?? "").toLowerCase();
  if (s.includes("http") || port === 443 || port === 80) return "web_server";
  if (s.includes("smtp") || port === 25 || port === 465 || port === 587) return "email_gateway";
  if (port === 22 || s.includes("ssh")) return "ssh_server";
  if (port === 500 || port === 4500 || s.includes("vpn") || s.includes("ipsec")) return "vpn_gateway";
  if (port === 389 || port === 636 || s.includes("ldap")) return "identity_provider";
  if (port === 3306 || port === 5432 || port === 1433 || s.includes("db") || s.includes("sql")) return "database";
  return "network_service";
}

function deriveCryptoUsageFromPort(port?: number, service?: string): CryptoUsageType {
  const s = (service ?? "").toLowerCase();
  if (port === 443 || s.includes("https") || s.includes("ssl/http")) return "tls";
  if (port === 22 || s.includes("ssh")) return "ssh";
  if (port === 500 || port === 4500 || s.includes("vpn") || s.includes("ipsec")) return "vpn";
  if (port === 25 || port === 465 || port === 587 || s.includes("smtp")) return "email_encryption";
  return deriveCryptoUsage(service ?? "");
}

// ── Shared Helpers ────────────────────────────────────────────────────────────

const USAGE_MAP: Array<[RegExp, CryptoUsageType]> = [
  [/\btls\b|\bssl\b|\bhttps\b/i, "tls"],
  [/\bcertif/i, "certificate"],
  [/\bvpn\b|\bipsec\b/i, "vpn"],
  [/\bssh\b/i, "ssh"],
  [/\bcode.sign/i, "code_signing"],
  [/\bemail\b|\bs\/mime\b|\bsmime\b/i, "email_encryption"],
  [/\bdatabase\b|\bdb.encrypt/i, "database_encryption"],
  [/\bapi.auth\b|\bjwt\b|\bhmac\b/i, "api_authentication"],
];

function deriveCryptoUsage(text: string): CryptoUsageType {
  for (const [pattern, usage] of USAGE_MAP) {
    if (pattern.test(text)) return usage;
  }
  return "unknown";
}

function isCryptoFinding(finding: RawScanFinding): boolean {
  const haystack = `${finding.category} ${finding.title} ${finding.description ?? ""}`.toLowerCase();
  return CRYPTO_SIGNALS.some((signal) => haystack.includes(signal));
}

function extractStr(meta: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const val = meta[key];
    if (typeof val === "string" && val.trim() !== "") return val.trim();
  }
  return undefined;
}

function extractNum(meta: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const val = meta[key];
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const n = parseInt(val, 10);
      if (!isNaN(n)) return n;
    }
  }
  return undefined;
}

function buildItem(fields: Omit<CryptoInventoryItem, "isQuantumVulnerable" | "quantumRiskLevel" | "vulnerabilityStatus">): CryptoInventoryItem {
  return {
    ...fields,
    isQuantumVulnerable: false,
    quantumRiskLevel: "unknown",
    vulnerabilityStatus: "unknown",
  };
}
