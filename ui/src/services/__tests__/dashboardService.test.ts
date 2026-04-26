import { beforeEach, describe, expect, it, vi } from "vitest";

import { dashboardService } from "../dashboardService";
import { complianceService } from "../complianceService";
import { incidentsService } from "../incidentsService";
import { scannerService } from "../scannerService";
import { trainingService } from "../trainingService";

vi.mock("../scannerService", () => ({
  scannerService: {
    getMetrics: vi.fn(),
    getAllVulnerabilities: vi.fn(),
    getSeverityDistribution: vi.fn(),
    getRecentScans: vi.fn(),
  },
}));

vi.mock("../incidentsService", () => ({
  incidentsService: {
    getMetrics: vi.fn(),
    getIncidents: vi.fn(),
  },
}));

vi.mock("../complianceService", () => ({
  complianceService: {
    getMetrics: vi.fn(),
    getAudits: vi.fn(),
  },
}));

vi.mock("../trainingService", () => ({
  trainingService: {
    getMetrics: vi.fn(),
    getModules: vi.fn(),
  },
}));

vi.mock("../monitoringService", () => ({
  monitoringService: {
    getChecks: vi.fn(),
  },
}));

const tenantId = "00000000-0000-4000-8000-000000000001";

describe("dashboardService", () => {
  beforeEach(() => {
    vi.mocked(scannerService.getMetrics).mockResolvedValue({
      totalScans: 0,
      activeScans: 0,
      totalVulnerabilities: 0,
      criticalVulnerabilities: 3,
      highVulnerabilities: 0,
      assetsMonitored: 0,
      lastScanTime: null,
    });
    vi.mocked(incidentsService.getMetrics).mockResolvedValue({
      total: 2,
      open: 2,
      investigating: 0,
      resolved: 0,
      closed: 0,
      critical: 0,
      high: 0,
      medium: 2,
      low: 0,
      avgResolutionTimeHours: 0,
    });
    vi.mocked(complianceService.getMetrics).mockResolvedValue({
      total: 0,
      compliant: 0,
      non_compliant: 0,
      partial: 0,
      overallScore: 88.2,
      frameworkScores: [],
    });
    vi.mocked(trainingService.getMetrics).mockResolvedValue({
      totalModules: 0,
      activeModules: 0,
      totalEnrolled: 0,
      totalCompleted: 0,
      avgCompletionRate: 72.4,
      categoryStats: [],
    });
  });

  it("getDashboardMetrics aggregates child services", async () => {
    const m = await dashboardService.getDashboardMetrics(tenantId);
    expect(m.activeThreats).toBe(3);
    expect(m.openIncidents).toBe(2);
    expect(m.complianceScore).toBe(88);
    expect(m.trainingCompletion).toBe(72);
    expect(m.lastUpdated).toBeTruthy();
  });

  it("getRecentAlerts maps vulnerabilities to alerts", async () => {
    vi.mocked(scannerService.getAllVulnerabilities).mockResolvedValue([
      {
        vulnerability_id: "00000000-0000-4000-8000-000000000002",
        client_id: 1,
        asset_id: 1,
        cve_id: null,
        title: "Test finding",
        description: "d",
        severity: "critical",
        cvss_score: 9,
        status: "open",
        discovered_date: "2025-01-01T00:00:00.000Z",
        fixed_date: null,
        remediation_steps: null,
        package_name: null,
        package_version: null,
      },
    ]);

    const alerts = await dashboardService.getRecentAlerts(5, tenantId);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("Critical");
    expect(alerts[0].title).toBe("Test finding");
  });
});
