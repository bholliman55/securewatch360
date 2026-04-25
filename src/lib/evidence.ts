import { getSupabaseAdminClient } from "@/lib/supabase";

type ScanCompletionFinding = {
  id: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
};

type CreateScanCompletionEvidenceInput = {
  tenantId: string;
  scanRunId: string;
  workflowRunId: string;
  findings: ScanCompletionFinding[];
  scannerName: string;
  scannerType: string;
  targetType: string;
  targetValue: string;
};

type ControlInfo = {
  frameworkCode: string;
  controlCode: string;
};

function extractFrameworkCode(raw: unknown): string | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const first = raw[0] as { framework_code?: string } | undefined;
    return first?.framework_code ?? null;
  }
  const obj = raw as { framework_code?: string };
  return obj.framework_code ?? null;
}

export async function createScanCompletionEvidence(
  input: CreateScanCompletionEvidenceInput
): Promise<number> {
  if (input.findings.length === 0) return 0;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("evidence_records")
    .insert(
      input.findings.map((finding) => ({
        tenant_id: input.tenantId,
        scan_run_id: input.scanRunId,
        finding_id: finding.id,
        control_framework: "securewatch_internal",
        control_id: "SW-SCAN-COMPLETE",
        evidence_type: "scan_result",
        title: "Scan completion evidence",
        description: "Automatically generated evidence row when a scan run completes.",
        payload: {
          event: "scan_completed",
          workflowRunId: input.workflowRunId,
          scanRunId: input.scanRunId,
          findingId: finding.id,
          severity: finding.severity,
          scannerName: input.scannerName,
          scannerType: input.scannerType,
          targetType: input.targetType,
          targetValue: input.targetValue,
          generatedAt: new Date().toISOString(),
        },
      }))
    )
    .select("id");

  if (error) {
    throw new Error(`Could not create scan completion evidence: ${error.message}`);
  }

  return data?.length ?? input.findings.length;
}

async function getControlsForFinding(tenantId: string, findingId: string): Promise<ControlInfo[]> {
  const supabase = getSupabaseAdminClient();

  const { data: mappings, error: mappingsError } = await supabase
    .from("finding_control_mappings")
    .select("control_requirement_id")
    .eq("tenant_id", tenantId)
    .eq("finding_id", findingId);

  if (mappingsError) {
    return [];
  }

  const controlRequirementIds = (mappings ?? [])
    .map((row) => row.control_requirement_id as string)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (controlRequirementIds.length === 0) return [];

  const { data: controls, error: controlsError } = await supabase
    .from("control_requirements")
    .select("control_code, framework:control_frameworks(framework_code)")
    .in("id", controlRequirementIds);

  if (controlsError) {
    return [];
  }

  return (controls ?? [])
    .map((row) => {
      const frameworkCode = extractFrameworkCode(row.framework);
      const controlCode = typeof row.control_code === "string" ? row.control_code : "";
      if (!frameworkCode || !controlCode) return null;
      return { frameworkCode: frameworkCode.toLowerCase(), controlCode };
    })
    .filter((row): row is ControlInfo => row !== null);
}

export async function createFindingResolvedEvidence(findingId: string): Promise<number> {
  const supabase = getSupabaseAdminClient();

  const { data: finding, error: findingError } = await supabase
    .from("findings")
    .select("id, tenant_id, scan_run_id, severity, status, title")
    .eq("id", findingId)
    .single();

  if (findingError || !finding) {
    throw new Error(findingError?.message ?? "Finding not found for evidence creation");
  }

  if (finding.status !== "resolved") {
    return 0;
  }

  const controls = await getControlsForFinding(finding.tenant_id, finding.id);
  const effectiveControls =
    controls.length > 0
      ? controls
      : [
          {
            frameworkCode: "unmapped",
            controlCode: "UNMAPPED.FINDING",
          },
        ];

  const { data, error } = await supabase
    .from("evidence_records")
    .insert(
      effectiveControls.map((control) => ({
        tenant_id: finding.tenant_id,
        scan_run_id: finding.scan_run_id,
        finding_id: finding.id,
        control_framework: control.frameworkCode,
        control_id: control.controlCode,
        evidence_type: "finding_resolution",
        title: "Finding resolved evidence",
        description: "Automatically generated evidence when finding status becomes resolved.",
        payload: {
          event: "finding_resolved",
          findingId: finding.id,
          scanRunId: finding.scan_run_id,
          severity: finding.severity,
          title: finding.title,
          status: finding.status,
          generatedAt: new Date().toISOString(),
        },
      }))
    )
    .select("id");

  if (error) {
    throw new Error(`Could not create finding resolved evidence: ${error.message}`);
  }

  return data?.length ?? effectiveControls.length;
}
