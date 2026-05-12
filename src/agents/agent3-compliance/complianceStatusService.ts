import { getSupabaseAdminClient } from "@/lib/supabase";

export interface ComplianceStatusInput {
  scanId: string;
  clientId?: string;
  framework?: string;
  tenantId: string;
}

export interface ControlStats {
  total: number;
  passing: number;
  failing: number;
  notApplicable: number;
}

export interface ComplianceStatusResult {
  scanId: string;
  framework?: string;
  controls: ControlStats;
  posture: "strong" | "moderate" | "weak" | "critical";
  completedAt: Date;
}

export async function runComplianceStatus(
  input: ComplianceStatusInput
): Promise<ComplianceStatusResult> {
  const client = getSupabaseAdminClient();

  // Query tenant_compliance_posture filtered by tenantId and optionally framework
  let query = client
    .from("tenant_compliance_posture")
    .select("*")
    .eq("tenant_id", input.tenantId);

  if (input.framework) {
    query = query.eq("framework", input.framework);
  }

  const { data: postures, error } = await query;

  if (error) {
    throw new Error(`Failed to query compliance posture: ${error.message}`);
  }

  // Aggregate control statistics
  const aggregated: ControlStats = {
    total: 0,
    passing: 0,
    failing: 0,
    notApplicable: 0,
  };

  let maxPassingRatio = 0;

  if (postures && postures.length > 0) {
    for (const posture of postures) {
      const controls = posture.controls || {};
      const total = (controls.total || 0) as number;
      const passing = (controls.passing || 0) as number;
      const failing = (controls.failing || 0) as number;
      const notApplicable = (controls.not_applicable || 0) as number;

      aggregated.total += total;
      aggregated.passing += passing;
      aggregated.failing += failing;
      aggregated.notApplicable += notApplicable;

      if (total > 0) {
        const ratio = passing / total;
        if (ratio > maxPassingRatio) {
          maxPassingRatio = ratio;
        }
      }
    }
  }

  // Determine posture based on passing ratio
  let posture: "strong" | "moderate" | "weak" | "critical";
  if (maxPassingRatio >= 0.9) {
    posture = "strong";
  } else if (maxPassingRatio >= 0.7) {
    posture = "moderate";
  } else if (maxPassingRatio >= 0.5) {
    posture = "weak";
  } else {
    posture = "critical";
  }

  return {
    scanId: input.scanId,
    framework: input.framework,
    controls: aggregated,
    posture,
    completedAt: new Date(),
  };
}
