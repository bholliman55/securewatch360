import { apiJson } from "../lib/apiFetch";

export interface Scan {
  scan_results_id: string;
  scan_type: string;
  target: string;
  status: string;
  severity_summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info?: number;
  };
  vulnerabilities_found: number;
  assets_scanned: number;
  started_at: string;
  scan_duration_seconds: number | null;
  critical_findings: number;
  high_findings: number;
  medium_findings: number;
  low_findings: number;
}

export interface Vulnerability {
  vulnerability_id: string;
  client_id: number;
  asset_id: number;
  cve_id: string | null;
  title: string;
  description: string | null;
  severity: string;
  cvss_score: number | null;
  status: string;
  discovered_date: string | null;
  fixed_date: string | null;
  remediation_steps: string | null;
  package_name: string | null;
  package_version: string | null;
  affected_asset?: string | null;
}

export interface Asset {
  asset_id: number;
  asset_name: string;
  asset_type: string;
  asset_identifier: string | null;
  operating_system: string | null;
  criticality: string;
  last_scan_date: string | null;
  vulnerability_count: number;
  environment: string | null;
  owner: string | null;
}

export interface ScannerMetrics {
  totalScans: number;
  activeScans: number;
  totalVulnerabilities: number;
  criticalVulnerabilities: number;
  highVulnerabilities: number;
  assetsMonitored: number;
  lastScanTime: string | null;
}

type FindingRow = {
  id: string;
  severity: string;
  category: string | null;
  title: string;
  description: string | null;
  status: string;
  asset_type: string | null;
  exposure: string | null;
  created_at: string;
  updated_at: string | null;
};

type ScanRunRow = {
  id: string;
  status: string;
  scanner_name: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  target_name: string | null;
  target_value: string | null;
};

function requireTenant(tenantId: string | null | undefined): string {
  if (!tenantId || tenantId.trim() === "") {
    throw new Error("Select a tenant to load scanner data.");
  }
  return tenantId;
}

function mapFindingToVulnerability(row: FindingRow): Vulnerability {
  return {
    vulnerability_id: row.id,
    client_id: 0,
    asset_id: 0,
    cve_id: null,
    title: row.title,
    description: row.description,
    severity: row.severity,
    cvss_score: null,
    status: row.status,
    discovered_date: row.created_at,
    fixed_date: null,
    remediation_steps: null,
    package_name: null,
    package_version: null,
    affected_asset: row.asset_type || row.exposure || null,
  };
}

function summaryFromResult(resultSummary: unknown): Scan["severity_summary"] {
  const empty = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  if (!resultSummary || typeof resultSummary !== "object") return empty;
  const s = resultSummary as Record<string, unknown>;
  const counts = (s.severity_counts ?? s.severityCounts) as Record<string, number> | undefined;
  if (counts && typeof counts === "object") {
    return {
      critical: Number(counts.critical) || 0,
      high: Number(counts.high) || 0,
      medium: Number(counts.medium) || 0,
      low: Number(counts.low) || 0,
      info: Number(counts.info) || 0,
    };
  }
  return empty;
}

function mapScanRun(row: ScanRunRow & { result_summary?: unknown }): Scan {
  const sev = summaryFromResult((row as { result_summary?: unknown }).result_summary);
  const totalFindings =
    sev.critical + sev.high + sev.medium + sev.low + (sev.info ?? 0);
  return {
    scan_results_id: row.id,
    scan_type: row.scanner_name || "scan",
    target: row.target_value || row.target_name || "",
    status: row.status,
    severity_summary: sev,
    vulnerabilities_found: totalFindings,
    assets_scanned: 0,
    started_at: row.started_at || row.created_at,
    scan_duration_seconds:
      row.started_at && row.completed_at
        ? Math.max(
            0,
            Math.round(
              (new Date(row.completed_at).getTime() - new Date(row.started_at).getTime()) / 1000
            )
          )
        : null,
    critical_findings: sev.critical,
    high_findings: sev.high,
    medium_findings: sev.medium,
    low_findings: sev.low,
  };
}

class ScannerService {
  async getMetrics(tenantId?: string | null): Promise<ScannerMetrics> {
    const tid = requireTenant(tenantId);
    const [cc, findingsRes, runsRes] = await Promise.all([
      apiJson<{
        ok: boolean;
        summary?: {
          totalFindings: number;
          highCriticalFindings: number;
        };
        recentScans?: { created_at: string }[];
      }>(`/api/command-center?tenantId=${encodeURIComponent(tid)}&recentLimit=8`),
      apiJson<{ ok: boolean; findings?: FindingRow[] }>(
        `/api/findings?tenantId=${encodeURIComponent(tid)}&limit=300`
      ).catch(() => ({ ok: false, findings: [] })),
      apiJson<{ ok: boolean; scanRuns?: ScanRunRow[] }>(
        `/api/scan-runs?tenantId=${encodeURIComponent(tid)}`
      ).catch(() => ({ ok: false, scanRuns: [] })),
    ]);

    const findings = findingsRes.findings ?? [];
    const criticalCount = findings.filter((f) => f.severity?.toLowerCase() === "critical").length;
    const highCount = findings.filter((f) => f.severity?.toLowerCase() === "high").length;

    const runs = runsRes.scanRuns ?? [];
    const activeScans = runs.filter((r) => r.status === "running").length;

    const lastScan =
      cc.recentScans && cc.recentScans.length > 0 ? cc.recentScans[0].created_at : null;

    return {
      totalScans: runs.length,
      activeScans,
      totalVulnerabilities: cc.summary?.totalFindings ?? findings.length,
      criticalVulnerabilities: criticalCount,
      highVulnerabilities: highCount,
      assetsMonitored: 0,
      lastScanTime: lastScan,
    };
  }

  async getRecentScans(limit: number = 10, tenantId?: string | null): Promise<Scan[]> {
    const tid = requireTenant(tenantId);
    const res = await apiJson<{ ok: boolean; scanRuns?: ScanRunRow[] }>(
      `/api/scan-runs?tenantId=${encodeURIComponent(tid)}`
    );
    const rows = res.scanRuns ?? [];
    return rows.slice(0, limit).map((r) => mapScanRun(r));
  }

  async getScanById(id: string, tenantId?: string | null): Promise<Scan | null> {
    const tid = requireTenant(tenantId);
    const res = await apiJson<{ ok: boolean; scanRuns?: ScanRunRow[] }>(
      `/api/scan-runs?tenantId=${encodeURIComponent(tid)}`
    );
    const row = (res.scanRuns ?? []).find((r) => r.id === id);
    return row ? mapScanRun(row) : null;
  }

  async getVulnerabilitiesByScan(scanId: string, tenantId?: string | null): Promise<Vulnerability[]> {
    const tid = requireTenant(tenantId);
    const res = await apiJson<{ ok: boolean; findings?: FindingRow[] }>(
      `/api/findings?tenantId=${encodeURIComponent(tid)}&scanRunId=${encodeURIComponent(scanId)}&limit=200`
    );
    return (res.findings ?? []).map(mapFindingToVulnerability);
  }

  async getAllVulnerabilities(limit: number = 50, tenantId?: string | null): Promise<Vulnerability[]> {
    const tid = requireTenant(tenantId);
    const res = await apiJson<{ ok: boolean; findings?: FindingRow[] }>(
      `/api/findings?tenantId=${encodeURIComponent(tid)}&limit=${limit}`
    );
    return (res.findings ?? []).map(mapFindingToVulnerability);
  }

  async getVulnerabilitiesByStatus(status: string, tenantId?: string | null): Promise<Vulnerability[]> {
    const tid = requireTenant(tenantId);
    const res = await apiJson<{ ok: boolean; findings?: FindingRow[] }>(
      `/api/findings?tenantId=${encodeURIComponent(tid)}&status=${encodeURIComponent(status)}&limit=200`
    );
    return (res.findings ?? []).map(mapFindingToVulnerability);
  }

  async getAssets(_tenantId?: string | null): Promise<Asset[]> {
    return [];
  }

  async getAssetById(_id: number): Promise<Asset | null> {
    return null;
  }

  async updateVulnerabilityStatus(id: string, status: string): Promise<void> {
    const apiStatus =
      status === "ignored"
        ? "risk_accepted"
        : status === "new"
          ? "open"
          : status;
    await apiJson(`/api/findings/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: apiStatus }),
    });
  }

  async createScan(_scan: Partial<Scan>): Promise<Scan> {
    throw new Error("Use scan target creation and /api/scans/request instead.");
  }

  async updateScan(_id: string, _updates: Partial<Scan>): Promise<void> {
    /* no-op: scan runs are workflow-driven */
  }

  async getSeverityDistribution(tenantId?: string | null): Promise<{ name: string; value: number; color: string }[]> {
    const tid = requireTenant(tenantId);
    const res = await apiJson<{ ok: boolean; findings?: { severity: string }[] }>(
      `/api/findings?tenantId=${encodeURIComponent(tid)}&limit=500`
    );
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const f of res.findings ?? []) {
      const sev = f.severity?.toLowerCase();
      if (sev && sev in counts) {
        counts[sev as keyof typeof counts]++;
      }
    }
    return [
      { name: "Critical", value: counts.critical, color: "#ef4444" },
      { name: "High", value: counts.high, color: "#f97316" },
      { name: "Medium", value: counts.medium, color: "#eab308" },
      { name: "Low", value: counts.low, color: "#3b82f6" },
      { name: "Info", value: counts.info, color: "#6b7280" },
    ];
  }
}

export const scannerService = new ScannerService();
