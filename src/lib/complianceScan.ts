import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const COMPLIANCE_SCAN_FRAMEWORKS = [
  {
    value: "cmmc_l1",
    label: "CMMC Level 1",
    frameworkCode: "CMMC",
    controlLimit: 17,
    filter: "l1",
  },
  {
    value: "cmmc_l2",
    label: "CMMC Level 2",
    frameworkCode: "CMMC",
    controlLimit: 110,
    filter: "l2",
  },
  {
    value: "cis_v8",
    label: "CIS Controls v8",
    frameworkCode: "CIS",
    controlLimit: 60,
  },
  {
    value: "nist_csf_2",
    label: "NIST CSF 2.0",
    frameworkCode: "NIST",
    controlLimit: 80,
  },
  {
    value: "hipaa_security",
    label: "HIPAA Security Rule",
    frameworkCode: "HIPAA",
    controlLimit: 80,
  },
  {
    value: "soc2",
    label: "SOC 2",
    frameworkCode: "SOC2",
    controlLimit: 80,
  },
] as const;

export type ComplianceScanFramework = (typeof COMPLIANCE_SCAN_FRAMEWORKS)[number]["value"];
export type ComplianceControlStatus = "pass" | "fail" | "partial" | "unknown";
export type ComplianceEvidenceStatus = "available" | "evidence_missing";
export type ComplianceSeverity = "info" | "low" | "medium" | "high" | "critical";

export type ComplianceScanControlResult = {
  framework: ComplianceScanFramework;
  control_id: string;
  control_name: string;
  status: ComplianceControlStatus;
  evidence_status: ComplianceEvidenceStatus;
  evidence: Record<string, unknown>;
  gap: string;
  recommended_action: string;
  severity: ComplianceSeverity;
  related_asset_id: string | null;
  related_scan_id: string;
  control_requirement_id?: string | null;
};

export type ComplianceScanSummary = {
  readinessPercentage: number;
  passedControls: number;
  failedControls: number;
  partialControls: number;
  unknownControls: number;
  totalControls: number;
  topGaps: Array<{
    control_id: string;
    control_name: string;
    status: ComplianceControlStatus;
    severity: ComplianceSeverity;
    gap: string;
    recommended_action: string;
  }>;
  framework: ComplianceScanFramework;
  frameworkLabel: string;
};

export type ComplianceEvidenceSnapshot = {
  assetCount: number | null;
  openFindings: number | null;
  highCriticalFindings: number | null;
  policyCount: number | null;
  endpointCoverageKnown: boolean;
  mfaStatusKnown: boolean;
  backupStatusKnown: boolean;
  loggingMonitoringKnown: boolean;
  awarenessTrainingKnown: boolean;
};

type ControlRequirement = {
  id: string | null;
  control_code: string;
  title: string;
  description: string | null;
};

export function getComplianceFramework(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return COMPLIANCE_SCAN_FRAMEWORKS.find((framework) => framework.value === normalized) ?? null;
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function isEvidenceMissing(value: number | null | boolean): boolean {
  return value === null || value === false;
}

export function evaluateComplianceControl(
  framework: ComplianceScanFramework,
  control: Pick<ControlRequirement, "control_code" | "title" | "description">,
  evidence: ComplianceEvidenceSnapshot,
  relatedScanId: string,
  relatedAssetId: string | null
): ComplianceScanControlResult {
  const text = `${control.control_code} ${control.title} ${control.description ?? ""}`.toLowerCase();
  const evidencePayload: Record<string, unknown> = {
    assetCount: evidence.assetCount,
    openFindings: evidence.openFindings,
    highCriticalFindings: evidence.highCriticalFindings,
    policyCount: evidence.policyCount,
    endpointCoverageKnown: evidence.endpointCoverageKnown,
    mfaStatusKnown: evidence.mfaStatusKnown,
    backupStatusKnown: evidence.backupStatusKnown,
    loggingMonitoringKnown: evidence.loggingMonitoringKnown,
    awarenessTrainingKnown: evidence.awarenessTrainingKnown,
  };

  let status: ComplianceControlStatus = "unknown";
  let evidenceStatus: ComplianceEvidenceStatus = "evidence_missing";
  let severity: ComplianceSeverity = "medium";
  let gap = "No authoritative evidence is available for this control.";
  let recommendedAction = "Connect evidence sources or attach auditor-ready evidence, then rerun the compliance scan.";

  if (includesAny(text, ["vulnerab", "risk", "scan", "ra-", "03.11", "si-2"])) {
    if (evidence.openFindings === null || evidence.highCriticalFindings === null) {
      status = "unknown";
    } else if (evidence.highCriticalFindings > 0) {
      status = "fail";
      evidenceStatus = "available";
      severity = "critical";
      gap = `${evidence.highCriticalFindings} high or critical vulnerability findings are open.`;
      recommendedAction = "Remediate or risk-accept high and critical findings tied to this scope.";
    } else if (evidence.openFindings > 0) {
      status = "partial";
      evidenceStatus = "available";
      severity = "high";
      gap = `${evidence.openFindings} vulnerability findings remain open.`;
      recommendedAction = "Close remaining findings and preserve remediation evidence.";
    } else {
      status = "pass";
      evidenceStatus = "available";
      severity = "info";
      gap = "No open vulnerability findings were found in current evidence.";
      recommendedAction = "Keep vulnerability scans current and retain scan evidence.";
    }
  } else if (includesAny(text, ["asset", "inventory", "boundary", "configuration", "device", "system"])) {
    if (isEvidenceMissing(evidence.assetCount)) {
      status = "unknown";
    } else if ((evidence.assetCount ?? 0) > 0) {
      status = "partial";
      evidenceStatus = "available";
      severity = "medium";
      gap = "Asset or scope inventory exists, but control-specific validation evidence is incomplete.";
      recommendedAction = "Map inventory ownership, criticality, and control evidence for the selected scope.";
    }
  } else if (includesAny(text, ["policy", "procedure", "governance", "management process"])) {
    if (isEvidenceMissing(evidence.policyCount)) {
      status = "unknown";
    } else if ((evidence.policyCount ?? 0) > 0) {
      status = "partial";
      evidenceStatus = "available";
      severity = "medium";
      gap = "Policies exist, but operating evidence is still required.";
      recommendedAction = "Attach recent review, approval, and operational enforcement evidence.";
    }
  } else if (includesAny(text, ["mfa", "multi-factor", "identity", "credential", "access"])) {
    if (!evidence.mfaStatusKnown) {
      status = "unknown";
    }
  } else if (includesAny(text, ["backup", "recovery", "contingency"])) {
    if (!evidence.backupStatusKnown) {
      status = "unknown";
    }
  } else if (includesAny(text, ["log", "monitor", "audit"])) {
    if (!evidence.loggingMonitoringKnown) {
      status = "unknown";
    }
  } else if (includesAny(text, ["awareness", "training", "literacy"])) {
    if (!evidence.awarenessTrainingKnown) {
      status = "unknown";
    }
  } else if (evidence.policyCount !== null || evidence.assetCount !== null || evidence.openFindings !== null) {
    status = "partial";
    evidenceStatus = "available";
    severity = "low";
    gap = "General security evidence exists, but this control has no direct evidence mapping.";
    recommendedAction = "Map specific evidence artifacts to this control.";
  }

  if (status === "unknown") {
    evidenceStatus = "evidence_missing";
    severity = "medium";
  }

  return {
    framework,
    control_id: control.control_code,
    control_name: control.title,
    status,
    evidence_status: evidenceStatus,
    evidence: {
      ...evidencePayload,
      evidence_status: evidenceStatus,
      evaluated_at: new Date().toISOString(),
    },
    gap,
    recommended_action: recommendedAction,
    severity,
    related_asset_id: relatedAssetId,
    related_scan_id: relatedScanId,
  };
}

export function summarizeComplianceResults(
  framework: ComplianceScanFramework,
  results: ComplianceScanControlResult[]
): ComplianceScanSummary {
  const frameworkDef = getComplianceFramework(framework);
  const passedControls = results.filter((r) => r.status === "pass").length;
  const failedControls = results.filter((r) => r.status === "fail").length;
  const partialControls = results.filter((r) => r.status === "partial").length;
  const unknownControls = results.filter((r) => r.status === "unknown").length;
  const totalControls = results.length;
  const readinessScore = passedControls + partialControls * 0.5;
  const readinessPercentage = totalControls > 0 ? Math.round((readinessScore / totalControls) * 100) : 0;
  const severityOrder: Record<ComplianceSeverity, number> = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    info: 1,
  };

  return {
    readinessPercentage,
    passedControls,
    failedControls,
    partialControls,
    unknownControls,
    totalControls,
    topGaps: results
      .filter((r) => r.status !== "pass")
      .sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity])
      .slice(0, 5)
      .map((r) => ({
        control_id: r.control_id,
        control_name: r.control_name,
        status: r.status,
        severity: r.severity,
        gap: r.gap,
        recommended_action: r.recommended_action,
      })),
    framework,
    frameworkLabel: frameworkDef?.label ?? framework,
  };
}

function fallbackControls(framework: ComplianceScanFramework): ControlRequirement[] {
  return [
    {
      id: null,
      control_code: "SW-ASSET-INVENTORY",
      title: "Asset inventory evidence",
      description: "Assets or scan targets are inventoried for the selected scope.",
    },
    {
      id: null,
      control_code: "SW-VULN-MGMT",
      title: "Vulnerability management evidence",
      description: "Vulnerabilities are identified, tracked, and remediated.",
    },
    {
      id: null,
      control_code: "SW-POLICY-EVIDENCE",
      title: "Policy and procedure evidence",
      description: "Policies and procedures are documented for this framework.",
    },
    {
      id: null,
      control_code: "SW-AWARENESS",
      title: "Security awareness training evidence",
      description: "Security awareness training completion is available.",
    },
  ].map((control) => ({
    ...control,
    control_code: `${framework.toUpperCase()}-${control.control_code}`,
  }));
}

async function loadControls(
  supabase: SupabaseClient,
  framework: NonNullable<ReturnType<typeof getComplianceFramework>>
): Promise<ControlRequirement[]> {
  const frameworkResponse = await supabase
    .from("control_frameworks")
    .select("id")
    .eq("framework_code", framework.frameworkCode)
    .maybeSingle();

  const frameworkId = (frameworkResponse.data as { id?: string } | null)?.id;
  if (!frameworkId) return fallbackControls(framework.value);

  const controlsResponse = await supabase
    .from("control_requirements")
    .select("id, control_code, title, description")
    .eq("framework_id", frameworkId)
    .order("control_code", { ascending: true })
    .limit(framework.controlLimit);

  if (controlsResponse.error || !controlsResponse.data?.length) {
    return fallbackControls(framework.value);
  }

  const rows = controlsResponse.data as ControlRequirement[];
  if ("filter" in framework && framework.filter === "l1") {
    const l1 = rows.filter((control) => control.control_code.toLowerCase().includes(".l1-"));
    return l1.length > 0 ? l1 : rows.slice(0, 17);
  }

  return rows;
}

async function countQuery(query: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const response = await query;
  if (response.error) return null;
  return response.count ?? 0;
}

async function collectEvidence(
  supabase: SupabaseClient,
  tenantId: string,
  targetIds: string[]
): Promise<ComplianceEvidenceSnapshot> {
  const targetFilter = targetIds.length > 0;
  const targetsQuery = supabase
    .from("scan_targets")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  const findingsQuery = supabase
    .from("findings")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .neq("status", "resolved");
  const highCriticalQuery = supabase
    .from("findings")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .in("severity", ["high", "critical"])
    .neq("status", "resolved");
  const policiesQuery = supabase
    .from("policies")
    .select("id", { count: "exact", head: true })
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .eq("is_active", true);

  if (targetFilter) {
    targetsQuery.in("id", targetIds);
    findingsQuery.in("scan_target_id", targetIds);
    highCriticalQuery.in("scan_target_id", targetIds);
  }

  const [assetCount, openFindings, highCriticalFindings, policyCount] = await Promise.all([
    countQuery(targetsQuery),
    countQuery(findingsQuery),
    countQuery(highCriticalQuery),
    countQuery(policiesQuery),
  ]);

  return {
    assetCount,
    openFindings,
    highCriticalFindings,
    policyCount,
    endpointCoverageKnown: false,
    mfaStatusKnown: false,
    backupStatusKnown: false,
    loggingMonitoringKnown: false,
    awarenessTrainingKnown: false,
  };
}

export async function executeComplianceScan(
  supabase: SupabaseClient,
  args: {
    tenantId: string;
    framework: ComplianceScanFramework;
    scope: string;
    scanTargetIds?: string[];
    actorUserId?: string | null;
  }
) {
  const framework = getComplianceFramework(args.framework);
  if (!framework) throw new Error("Unsupported compliance framework");

  const startedAt = new Date().toISOString();
  const scanTargetIds = Array.from(new Set((args.scanTargetIds ?? []).filter(Boolean)));
  const primaryTargetId = scanTargetIds[0] ?? null;
  const evidence = await collectEvidence(supabase, args.tenantId, scanTargetIds);

  const { data: scanRun, error: scanRunError } = await supabase
    .from("scan_runs")
    .insert({
      tenant_id: args.tenantId,
      scan_target_id: primaryTargetId,
      workflow_run_id: `compliance-${randomUUID()}`,
      status: "running",
      scanner_name: "Compliance Scan",
      scanner_type: "compliance",
      started_at: startedAt,
      target_snapshot: {
        framework: framework.value,
        frameworkLabel: framework.label,
        scope: args.scope,
        scanTargetIds,
      },
    })
    .select("id")
    .single();

  if (scanRunError || !scanRun) {
    throw new Error(scanRunError?.message ?? "Could not create compliance scan run");
  }

  const scanRunId = (scanRun as { id: string }).id;
  const controls = await loadControls(supabase, framework);
  const results = controls.map((control) => ({
    ...evaluateComplianceControl(framework.value, control, evidence, scanRunId, primaryTargetId),
    control_requirement_id: control.id,
  }));
  const summary = summarizeComplianceResults(framework.value, results);
  const completedAt = new Date().toISOString();

  const { error: resultInsertError } = await supabase.from("compliance_scan_results").insert(
    results.map((result) => ({
      tenant_id: args.tenantId,
      scan_run_id: scanRunId,
      framework: result.framework,
      control_requirement_id: result.control_requirement_id,
      control_id: result.control_id,
      control_name: result.control_name,
      status: result.status,
      evidence_status: result.evidence_status,
      evidence: result.evidence,
      gap: result.gap,
      recommended_action: result.recommended_action,
      severity: result.severity,
      related_asset_id: result.related_asset_id,
      related_scan_id: result.related_scan_id,
    }))
  );

  if (resultInsertError) {
    await supabase
      .from("scan_runs")
      .update({ status: "failed", completed_at: completedAt, error_message: resultInsertError.message })
      .eq("id", scanRunId);
    throw new Error(resultInsertError.message);
  }

  const findingRows = results
    .filter((result) => result.status !== "pass")
    .map((result) => ({
      tenant_id: args.tenantId,
      scan_run_id: scanRunId,
      scan_id: scanRunId,
      scan_result_id: scanRunId,
      scan_target_id: result.related_asset_id,
      severity: result.severity,
      category: "compliance",
      title: `${framework.label}: ${result.control_id} ${result.status}`,
      description: result.gap,
      evidence: {
        framework: result.framework,
        control_id: result.control_id,
        control_name: result.control_name,
        status: result.status,
        evidence_status: result.evidence_status,
        recommended_action: result.recommended_action,
      },
      status: "open",
      asset_type: "compliance_control",
      exposure: args.scope || "tenant",
      priority_score:
        result.severity === "critical" ? 95 : result.severity === "high" ? 80 : result.severity === "medium" ? 55 : 25,
    }));

  if (findingRows.length > 0) {
    const { error: findingsError } = await supabase.from("findings").insert(findingRows);
    if (findingsError) {
      await supabase
        .from("scan_runs")
        .update({ status: "failed", completed_at: completedAt, error_message: findingsError.message })
        .eq("id", scanRunId);
      throw new Error(findingsError.message);
    }
  }

  const { error: updateError } = await supabase
    .from("scan_runs")
    .update({
      status: "completed",
      completed_at: completedAt,
      result_summary: {
        scan_type: "compliance",
        framework: framework.value,
        frameworkLabel: framework.label,
        scope: args.scope,
        scanTargetIds,
        compliance: summary,
        evidence,
        severity_counts: {
          critical: findingRows.filter((row) => row.severity === "critical").length,
          high: findingRows.filter((row) => row.severity === "high").length,
          medium: findingRows.filter((row) => row.severity === "medium").length,
          low: findingRows.filter((row) => row.severity === "low").length,
          info: findingRows.filter((row) => row.severity === "info").length,
        },
      },
    })
    .eq("id", scanRunId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    scanRunId,
    summary,
    results,
  };
}
