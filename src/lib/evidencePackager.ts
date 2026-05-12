import { getSupabaseAdminClient } from "@/lib/supabase";

export interface ControlEvidence {
  controlId: string;
  controlName: string;
  framework: string;
  status: string;
  findingCount: number;
  findings: { id: string; title: string; severity: string }[];
}

export interface EvidencePackage {
  framework: string;
  generatedAt: string;
  tenantId: string;
  summary: {
    totalControls: number;
    passing: number;
    failing: number;
    notApplicable: number;
    evidenceCount: number;
  };
  controls: ControlEvidence[];
  findings: Record<string, unknown>[];
  auditLog: Record<string, unknown>[];
}

export async function buildEvidencePackage(
  tenantId: string,
  framework: string
): Promise<EvidencePackage> {
  const supabase = getSupabaseAdminClient();
  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [postureRes, findingsRes, evidenceRes, auditRes] = await Promise.all([
    supabase
      .from("tenant_compliance_posture")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("framework", framework),
    supabase
      .from("findings")
      .select("id, title, severity, status, asset_type, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("evidence_records")
      .select("id, description, evidence_type, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", since90d)
      .order("created_at", { ascending: false }),
    supabase
      .from("audit_logs")
      .select("id, action, actor_user_id, resource_type, resource_id, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", since90d)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const postures = postureRes.data ?? [];
  const findings = (findingsRes.data ?? []) as Record<string, unknown>[];
  const evidenceRecords = evidenceRes.data ?? [];
  const auditLog = (auditRes.data ?? []) as Record<string, unknown>[];

  // Build control evidence from posture records
  const controls: ControlEvidence[] = postures.map((p) => {
    const ctrl = (p.controls ?? {}) as Record<string, unknown>;
    const passing = (ctrl.passing as number) ?? 0;
    const failing = (ctrl.failing as number) ?? 0;
    const notApplicable = (ctrl.not_applicable as number) ?? 0;
    const status = failing > 0 ? "failing" : passing > 0 ? "passing" : "not_applicable";
    return {
      controlId: (p.framework as string) ?? framework,
      controlName: (p.framework as string) ?? framework,
      framework,
      status,
      findingCount: failing,
      findings: findings.slice(0, 5).map((f) => ({
        id: f.id as string,
        title: f.title as string,
        severity: f.severity as string,
      })),
      _passing: passing,
      _failing: failing,
      _notApplicable: notApplicable,
    } as ControlEvidence & { _passing: number; _failing: number; _notApplicable: number };
  });

  const totals = controls.reduce(
    (acc, c) => {
      const ext = c as ControlEvidence & { _passing: number; _failing: number; _notApplicable: number };
      acc.passing += ext._passing ?? 0;
      acc.failing += ext._failing ?? 0;
      acc.notApplicable += ext._notApplicable ?? 0;
      acc.total += (ext._passing ?? 0) + (ext._failing ?? 0) + (ext._notApplicable ?? 0);
      return acc;
    },
    { total: 0, passing: 0, failing: 0, notApplicable: 0 }
  );

  return {
    framework,
    generatedAt: new Date().toISOString(),
    tenantId,
    summary: {
      totalControls: totals.total,
      passing: totals.passing,
      failing: totals.failing,
      notApplicable: totals.notApplicable,
      evidenceCount: evidenceRecords.length,
    },
    controls,
    findings,
    auditLog,
  };
}
