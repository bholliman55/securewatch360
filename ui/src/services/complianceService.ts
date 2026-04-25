import { apiJson } from "../lib/apiFetch";

export interface ComplianceAudit {
  id: string;
  framework: string;
  requirement: string;
  status: string;
  score: number;
  evidence: string;
  last_audit: string;
  next_audit: string | null;
  owner: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

function requireTenant(tenantId: string | null | undefined): string {
  if (!tenantId || tenantId.trim() === "") {
    throw new Error("Select a tenant to load compliance data.");
  }
  return tenantId;
}

type ControlRow = {
  controlRequirementId: string;
  frameworkCode: string;
  controlCode: string;
  controlTitle: string;
  status: string;
  failingFindings: number;
};

export const complianceService = {
  async getAudits(tenantId?: string | null): Promise<ComplianceAudit[]> {
    const tid = requireTenant(tenantId);
    const res = await apiJson<{ ok: boolean; controls?: ControlRow[] }>(
      `/api/compliance/control-status?tenantId=${encodeURIComponent(tid)}`
    );
    const now = new Date().toISOString();
    return (res.controls ?? []).map((c) => ({
      id: c.controlRequirementId,
      framework: c.frameworkCode,
      requirement: `${c.controlCode}: ${c.controlTitle}`,
      status: c.status === "pass" ? "compliant" : "non_compliant",
      score: c.status === "pass" ? 100 : 0,
      evidence: `${c.failingFindings} open finding(s)`,
      last_audit: now,
      next_audit: null,
      owner: "Platform",
      notes: "",
      created_at: now,
      updated_at: now,
    }));
  },

  async getMetrics(tenantId?: string | null) {
    const audits = await this.getAudits(tenantId);

    const statusCounts = audits.reduce(
      (acc, audit) => {
        acc[audit.status] = (acc[audit.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const frameworkScores = audits.reduce(
      (acc, audit) => {
        if (!acc[audit.framework]) {
          acc[audit.framework] = { total: 0, count: 0 };
        }
        acc[audit.framework].total += Number(audit.score);
        acc[audit.framework].count += 1;
        return acc;
      },
      {} as Record<string, { total: number; count: number }>
    );

    const overallScore =
      audits.length > 0 ? audits.reduce((sum, audit) => sum + Number(audit.score), 0) / audits.length : 0;

    return {
      total: audits.length,
      compliant: statusCounts.compliant || 0,
      non_compliant: statusCounts.non_compliant || 0,
      partial: statusCounts.partial || 0,
      overallScore: Number(overallScore.toFixed(1)),
      frameworkScores: Object.entries(frameworkScores).map(([name, data]) => ({
        name,
        score: Number((data.total / data.count).toFixed(1)),
      })),
    };
  },
};
