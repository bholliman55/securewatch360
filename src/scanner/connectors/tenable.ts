import { fetchWithRetry } from "@/scanner/reliability";
import type { RawScannerFinding, ScanTargetInput } from "@/scanner/types";

type TenableVulnerability = {
  plugin_id?: number;
  plugin_name?: string;
  severity?: number | string;
  severity_id?: number;
  description?: string;
  cve?: string | string[];
  cves?: string[];
  family?: string;
  state?: string;
  asset?: Record<string, unknown>;
};

type TenableResponse = {
  vulnerabilities?: TenableVulnerability[];
  pagination?: {
    offset?: number;
    limit?: number;
    total?: number;
  };
};

function normalizeSeverity(raw: number | string | undefined): RawScannerFinding["severity"] {
  const value = typeof raw === "string" ? Number(raw) : raw ?? 0;
  if (value >= 4) return "critical";
  if (value === 3) return "high";
  if (value === 2) return "medium";
  if (value === 1) return "low";
  return "info";
}

function toCves(vuln: TenableVulnerability): string[] {
  if (Array.isArray(vuln.cves)) return vuln.cves.filter(Boolean);
  if (Array.isArray(vuln.cve)) return vuln.cve.filter(Boolean);
  if (typeof vuln.cve === "string" && vuln.cve.trim()) {
    return vuln.cve
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function parseAccessKeyHeader(key: string, secret: string): string {
  return `accessKey=${key}; secretKey=${secret}`;
}

export async function fetchTenableFindings(target: ScanTargetInput): Promise<RawScannerFinding[]> {
  const baseUrl = (process.env.TENABLE_BASE_URL ?? "https://cloud.tenable.com").replace(/\/+$/, "");
  const accessKey = process.env.TENABLE_ACCESS_KEY;
  const secretKey = process.env.TENABLE_SECRET_KEY;

  if (!accessKey || !secretKey) {
    throw new Error("TENABLE_ACCESS_KEY and TENABLE_SECRET_KEY are required for Tenable connector");
  }

  const headers = {
    "x-apikeys": parseAccessKeyHeader(accessKey, secretKey),
    Accept: "application/json",
  };
  const limit = 200;
  let offset = 0;
  const findings: RawScannerFinding[] = [];

  while (offset >= 0) {
    const url =
      `${baseUrl}/workbenches/vulnerabilities?` +
      `filter.0.filter=asset&filter.0.quality=eq&filter.0.value=${encodeURIComponent(target.targetValue)}` +
      `&limit=${limit}&offset=${offset}`;

    const response = await fetchWithRetry({
      url,
      init: { method: "GET", headers },
      attempts: 4,
      initialDelayMs: 600,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Tenable API failed (${response.status}): ${body.slice(0, 300)}`);
    }

    const payload = (await response.json()) as TenableResponse;
    const vulnerabilities = payload.vulnerabilities ?? [];

    findings.push(
      ...vulnerabilities.map((vuln, index): RawScannerFinding => {
        const pluginId = vuln.plugin_id ?? `unknown-${offset + index}`;
        return {
          externalId: `tenable:${pluginId}`,
          severity: normalizeSeverity(vuln.severity_id ?? vuln.severity),
          category: vuln.family ?? "infrastructure_vulnerability",
          title: vuln.plugin_name ?? "Tenable finding",
          description: vuln.description ?? "Tenable vulnerability finding",
          cves: toCves(vuln),
          metadata: {
            source: "tenable",
            pluginId: vuln.plugin_id ?? null,
            state: vuln.state ?? null,
            asset: vuln.asset ?? null,
          },
        };
      })
    );

    const pageCount = vulnerabilities.length;
    const total = payload.pagination?.total;
    if (pageCount < limit) break;
    if (typeof total === "number" && offset + pageCount >= total) break;
    offset += pageCount;
  }

  return findings;
}
