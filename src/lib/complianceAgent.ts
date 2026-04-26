import { writeAuditLog } from "@/lib/audit";
import { buildComplianceContextBundle } from "@/lib/token-optimization/context-builders/complianceContextBuilder";
import { MockLlmProviderAdapter } from "@/lib/token-optimization/mockLlmProviderAdapter";
import { optimizedLlmGateway } from "@/lib/token-optimization/optimizedLlmGateway";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { DecisionOutput } from "@/types/policy";

type ComplianceImpact = "none" | "low" | "moderate" | "high" | "critical";

type ComplianceControlRef = {
  frameworkCode: string;
  controlCode: string;
};

type ComplianceMappingRule = {
  categoryPatterns: string[];
  controls: ComplianceControlRef[];
  minimumImpact: Exclude<ComplianceImpact, "none">;
};

export type ComplianceAgentHookInput = {
  tenantId: string;
  scanRunId: string;
  workflowRunId: string;
  findingId: string;
  findingCategory: string | null;
  findingTitle: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  decisionOutput: DecisionOutput;
  policyDecisionId: string;
};

export type ComplianceAgentHookResult = {
  findingId: string;
  complianceImpact: ComplianceImpact;
  mappedControlsCount: number;
  evidenceRecordsCreated: number;
};

const IMPACT_ORDER: Record<ComplianceImpact, number> = {
  none: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

const DEFAULT_COMPLIANCE_MAPPING_RULES: ComplianceMappingRule[] = [
  {
    categoryPatterns: ["auth", "identity", "access", "credential", "permission"],
    controls: [
      { frameworkCode: "SOC2", controlCode: "CC6.1" },
      { frameworkCode: "NIST", controlCode: "PR.AC-1" },
      { frameworkCode: "CMMC", controlCode: "AC.L1-3.1.1" },
    ],
    minimumImpact: "high",
  },
  {
    categoryPatterns: ["config", "misconfig", "hardening", "baseline"],
    controls: [
      { frameworkCode: "NIST", controlCode: "PR.AC-1" },
      { frameworkCode: "SOC2", controlCode: "CC6.1" },
    ],
    minimumImpact: "moderate",
  },
  {
    categoryPatterns: ["phi", "hipaa", "privacy", "pii", "health"],
    controls: [{ frameworkCode: "HIPAA", controlCode: "164.308(a)(1)" }],
    minimumImpact: "high",
  },
  {
    categoryPatterns: ["network", "port", "exposure", "service"],
    controls: [
      { frameworkCode: "CMMC", controlCode: "AC.L1-3.1.1" },
      { frameworkCode: "SOC2", controlCode: "CC6.1" },
    ],
    minimumImpact: "moderate",
  },
];

function getSeverityImpact(severity: ComplianceAgentHookInput["severity"]): ComplianceImpact {
  switch (severity) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "medium":
      return "moderate";
    case "low":
      return "low";
    default:
      return "none";
  }
}

function maxImpact(a: ComplianceImpact, b: ComplianceImpact): ComplianceImpact {
  return IMPACT_ORDER[a] >= IMPACT_ORDER[b] ? a : b;
}

function hasAnyPatternMatch(input: string, patterns: string[]): boolean {
  return patterns.some((pattern) => input.includes(pattern));
}

function uniqueControls(controls: ComplianceControlRef[]): ComplianceControlRef[] {
  const seen = new Set<string>();
  const results: ComplianceControlRef[] = [];
  for (const control of controls) {
    const key = `${control.frameworkCode.toUpperCase()}::${control.controlCode.toUpperCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      frameworkCode: control.frameworkCode.toUpperCase(),
      controlCode: control.controlCode,
    });
  }
  return results;
}

function inferComplianceImpact(
  severity: ComplianceAgentHookInput["severity"],
  decisionOutput: DecisionOutput,
  rules: ComplianceMappingRule[]
): ComplianceImpact {
  let impact = getSeverityImpact(severity);

  for (const rule of rules) {
    impact = maxImpact(impact, rule.minimumImpact);
  }

  if (decisionOutput.action === "block") {
    impact = maxImpact(impact, "critical");
  } else if (decisionOutput.requiresApproval) {
    impact = maxImpact(impact, "high");
  } else if (decisionOutput.action === "monitor_only") {
    impact = maxImpact(impact, "low");
  }

  return impact;
}

async function resolveControlRequirementIds(
  tenantId: string,
  controls: ComplianceControlRef[]
): Promise<Array<{ id: string; frameworkCode: string; controlCode: string }>> {
  if (controls.length === 0) return [];

  const supabase = getSupabaseAdminClient();
  const resolved: Array<{ id: string; frameworkCode: string; controlCode: string }> = [];

  for (const control of controls) {
    const { data, error } = await supabase
      .from("control_requirements")
      .select("id, control_code, framework:control_frameworks!inner(framework_code)")
      .eq("control_code", control.controlCode)
      .eq("control_frameworks.framework_code", control.frameworkCode)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      continue;
    }

    const framework = data.framework as { framework_code?: string } | { framework_code?: string }[] | null;
    const frameworkCode = Array.isArray(framework)
      ? framework[0]?.framework_code
      : framework?.framework_code;

    if (!frameworkCode) continue;

    resolved.push({
      id: data.id as string,
      frameworkCode,
      controlCode: data.control_code as string,
    });
  }

  if (resolved.length === 0) {
    await writeAuditLog({
      userId: null,
      tenantId,
      entityType: "finding",
      entityId: "unmapped-control",
      action: "compliance.hook.control_resolution_empty",
      summary: "No control requirements resolved for compliance hook controls",
      payload: { requestedControls: controls },
    });
  }

  return resolved;
}

export async function runComplianceAgentHook(
  input: ComplianceAgentHookInput,
  rules: ComplianceMappingRule[] = DEFAULT_COMPLIANCE_MAPPING_RULES
): Promise<ComplianceAgentHookResult> {
  const supabase = getSupabaseAdminClient();
  const normalizedText = `${input.findingCategory ?? ""} ${input.findingTitle}`.toLowerCase();
  const matchedRules = rules.filter((rule) => hasAnyPatternMatch(normalizedText, rule.categoryPatterns));
  const requestedControls = uniqueControls(matchedRules.flatMap((rule) => rule.controls));
  const resolvedControls = await resolveControlRequirementIds(input.tenantId, requestedControls);
  const complianceImpact = inferComplianceImpact(input.severity, input.decisionOutput, matchedRules);
  let evidenceSummary = "Generated by compliance hook after policy decision.";
  let controlGapExplanation = "Control gaps were inferred from deterministic finding-to-control mapping rules.";
  let auditorWording = "Control linkage derived from finding category and decision context.";

  try {
    const adapter = new MockLlmProviderAdapter();
    // LLM output is assistive wording only; compliance impact/pass-fail logic remains deterministic.
    const [summaryResult, controlGapResult, wordingResult] = await Promise.all([
      optimizedLlmGateway(adapter, {
        tenantId: input.tenantId,
        agent: "compliance",
        taskType: "evidence_summary",
        model: "mock-securewatch-v1",
        instruction:
          "Summarize evidence context for auditors in one short paragraph without policy decisions.",
        contextBundle: await buildComplianceContextBundle({
          tenantId: input.tenantId,
          findingId: input.findingId,
          scanRunId: input.scanRunId,
          taskType: "evidence_summary",
        }),
        maxCompletionTokens: 180,
        allowCache: true,
      }),
      optimizedLlmGateway(adapter, {
        tenantId: input.tenantId,
        agent: "compliance",
        taskType: "control_gap_explanation",
        model: "mock-securewatch-v1",
        instruction:
          "Explain control gaps in auditor-friendly terms using mapped controls and evidence context. Do not determine final pass/fail status.",
        contextBundle: await buildComplianceContextBundle({
          tenantId: input.tenantId,
          findingId: input.findingId,
          scanRunId: input.scanRunId,
          taskType: "control_gap_explanation",
        }),
        maxCompletionTokens: 180,
        allowCache: true,
      }),
      optimizedLlmGateway(adapter, {
        tenantId: input.tenantId,
        agent: "compliance",
        taskType: "auditor_wording",
        model: "mock-securewatch-v1",
        instruction:
          "Provide auditor-friendly wording that explains why this evidence is attached. Keep under 40 words.",
        contextBundle: await buildComplianceContextBundle({
          tenantId: input.tenantId,
          findingId: input.findingId,
          scanRunId: input.scanRunId,
          taskType: "auditor_wording",
        }),
        maxCompletionTokens: 120,
        allowCache: true,
      }),
    ]);
    evidenceSummary = summaryResult.response;
    controlGapExplanation = controlGapResult.response;
    auditorWording = wordingResult.response;
  } catch {
    // Keep deterministic fallback wording if token layer has issues.
    controlGapExplanation =
      "Control gap explanation fallback: mapped controls and decision reasons indicate remediation evidence is required before closure.";
  }

  if (resolvedControls.length > 0) {
    const { error: mappingsError } = await supabase.from("finding_control_mappings").upsert(
      resolvedControls.map((control) => ({
        tenant_id: input.tenantId,
        finding_id: input.findingId,
        control_requirement_id: control.id,
        mapping_source: "compliance_agent",
        notes: `Mapped by compliance hook after policy decision ${input.policyDecisionId}.`,
        updated_at: new Date().toISOString(),
      })),
      {
        onConflict: "tenant_id,finding_id,control_requirement_id",
      }
    );

    if (mappingsError) {
      throw new Error(`Could not map finding to compliance controls: ${mappingsError.message}`);
    }
  }

  const { error: findingUpdateError } = await supabase
    .from("findings")
    .update({
      compliance_impact: complianceImpact,
      compliance_context: {
        policyDecisionId: input.policyDecisionId,
        matchedRules: matchedRules.map((rule) => ({
          categoryPatterns: rule.categoryPatterns,
          controls: rule.controls,
          minimumImpact: rule.minimumImpact,
        })),
        mappedControls: resolvedControls.map((control) => ({
          frameworkCode: control.frameworkCode,
          controlCode: control.controlCode,
        })),
        decisionAction: input.decisionOutput.action,
        controlGapExplanation,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.findingId);

  if (findingUpdateError) {
    throw new Error(`Could not update finding compliance impact: ${findingUpdateError.message}`);
  }

  let evidenceRecordsCreated = 0;
  if (resolvedControls.length > 0 && complianceImpact !== "none") {
    const { data: evidenceRows, error: evidenceError } = await supabase
      .from("evidence_records")
      .insert(
        resolvedControls.map((control) => ({
          tenant_id: input.tenantId,
          scan_run_id: input.scanRunId,
          finding_id: input.findingId,
          control_framework: control.frameworkCode.toLowerCase(),
          control_id: control.controlCode,
          evidence_type: "policy_decision",
          title: "Compliance agent decision evidence",
          description: evidenceSummary,
          payload: {
            event: "finding_decision_compliance_hook",
            workflowRunId: input.workflowRunId,
            policyDecisionId: input.policyDecisionId,
            findingId: input.findingId,
            complianceImpact,
            decisionAction: input.decisionOutput.action,
            decisionReasons: input.decisionOutput.reasonCodes,
            controlGapExplanation,
            auditorWording,
            generatedAt: new Date().toISOString(),
          },
        }))
      )
      .select("id");

    if (evidenceError) {
      throw new Error(`Could not create compliance evidence records: ${evidenceError.message}`);
    }

    evidenceRecordsCreated = evidenceRows?.length ?? resolvedControls.length;
  }

  await writeAuditLog({
    userId: null,
    tenantId: input.tenantId,
    entityType: "finding",
    entityId: input.findingId,
    action: "compliance.hook.executed",
    summary: `Compliance hook executed for finding ${input.findingId}`,
    payload: {
      scanRunId: input.scanRunId,
      workflowRunId: input.workflowRunId,
      policyDecisionId: input.policyDecisionId,
      complianceImpact,
      matchedRuleCount: matchedRules.length,
      mappedControlCount: resolvedControls.length,
      evidenceRecordsCreated,
    },
  });

  return {
    findingId: input.findingId,
    complianceImpact,
    mappedControlsCount: resolvedControls.length,
    evidenceRecordsCreated,
  };
}
