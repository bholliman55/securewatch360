import { apiJson } from "../lib/apiFetch";

export interface MonitoringCheck {
  id: string;
  check_name: string;
  check_type: string;
  target: string;
  status: string;
  last_check: string;
  response_time: number;
  uptime_percentage: number;
  details: unknown;
  created_at: string;
  updated_at: string;
}

function requireTenant(tenantId: string | null | undefined): string {
  if (!tenantId || tenantId.trim() === "") {
    throw new Error("Select a tenant to load monitoring data.");
  }
  return tenantId;
}

type ScanRunRow = {
  id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  target_name: string | null;
  target_value: string | null;
};

function runToCheck(row: ScanRunRow, index: number): MonitoringCheck {
  const statusMap: Record<string, string> = {
    completed: "healthy",
    running: "warning",
    failed: "critical",
    queued: "warning",
    cancelled: "warning",
  };
  const st = statusMap[row.status] ?? "warning";
  return {
    id: row.id,
    check_name: `Scan ${index + 1}`,
    check_type: "scan_run",
    target: row.target_value || row.target_name || "—",
    status: st,
    last_check: row.completed_at || row.created_at,
    response_time: 0,
    uptime_percentage: row.status === "completed" ? 100 : row.status === "running" ? 99 : 95,
    details: { scanRunStatus: row.status },
    created_at: row.created_at,
    updated_at: row.completed_at || row.created_at,
  };
}

export const monitoringService = {
  async getChecks(tenantId?: string | null): Promise<MonitoringCheck[]> {
    const tid = requireTenant(tenantId);
    const res = await apiJson<{ ok: boolean; scanRuns?: ScanRunRow[] }>(
      `/api/scan-runs?tenantId=${encodeURIComponent(tid)}`
    );
    const rows = (res.scanRuns ?? []).slice(0, 25);
    return rows.map((r, i) => runToCheck(r, i));
  },

  async getMetrics(tenantId?: string | null) {
    const checks = await this.getChecks(tenantId);

    const statusCounts = checks.reduce(
      (acc, check) => {
        acc[check.status] = (acc[check.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const avgResponseTime =
      checks.length > 0 ? checks.reduce((sum, check) => sum + check.response_time, 0) / checks.length : 0;

    const avgUptime =
      checks.length > 0
        ? checks.reduce((sum, check) => sum + Number(check.uptime_percentage), 0) / checks.length
        : 100;

    return {
      total: checks.length,
      healthy: statusCounts.healthy || 0,
      warning: statusCounts.warning || 0,
      critical: statusCounts.critical || 0,
      avgResponseTime: Math.round(avgResponseTime),
      avgUptime: Number(avgUptime.toFixed(2)),
    };
  },
};
