import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { getSupabaseAdminClient } from "../src/lib/supabase";
import { evaluateDecision } from "../src/lib/decisionEngine";
import { runComplianceAgentHook } from "../src/lib/complianceAgent";
import type { DecisionOutput } from "../src/types/policy";

loadEnvConfig(process.cwd());

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function mapDecisionResult(output: DecisionOutput): "allow" | "deny" | "defer" | "require_approval" {
  if (output.action === "block") return "deny";
  if (output.requiresApproval) return "require_approval";
  if (output.action === "monitor_only") return "defer";
  return "allow";
}

async function main() {
  const tenantId = process.env.TEST_TENANT_ID?.trim();
  assert(tenantId, "Missing TEST_TENANT_ID");

  const supabase = getSupabaseAdminClient();

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id")
    .eq("id", tenantId)
    .maybeSingle();
  if (tenantError) throw new Error(`Could not load tenant: ${tenantError.message}`);
  assert(tenant?.id, `Tenant not found: ${tenantId}`);

  const { data: target, error: targetError } = await supabase
    .from("scan_targets")
    .select("id, target_type, target_value")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (targetError) throw new Error(`Could not load scan target: ${targetError.message}`);
  assert(target?.id, "No active scan_target found for TEST_TENANT_ID");

  const runId = randomUUID();
  const findingId = randomUUID();
  const workflowRunId = `qa-hipaa-operational-${Date.now()}`;
  let policyDecisionId: string | null = null;

  try {
    const { error: runError } = await supabase.from("scan_runs").insert({
      id: runId,
      tenant_id: tenantId,
      scan_target_id: target.id,
      workflow_run_id: workflowRunId,
      status: "completed",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      scanner_name: "qa-hipaa-operational",
      scanner_type: "mock",
    });
    if (runError) throw new Error(`Could not create scan_run: ${runError.message}`);

    const { error: findingError } = await supabase.from("findings").insert({
      id: findingId,
      tenant_id: tenantId,
      scan_run_id: runId,
      severity: "high",
      category: "hipaa-ephi-access-control",
      title: "QA HIPAA ePHI strict review signal",
      description: "Synthetic finding to prove HIPAA operational wiring.",
      evidence: { source: "qa-hipaa-operational", cve: "CVE-2024-99999" },
      status: "open",
      asset_type: target.target_type,
      exposure: "internet",
      priority_score: 90,
    });
    if (findingError) throw new Error(`Could not create finding: ${findingError.message}`);

    const decisionInput = {
      tenantId,
      findingId,
      severity: "high" as const,
      category: "hipaa ephi health privacy access",
      assetType: target.target_type as string,
      targetType: target.target_type as string,
      exposure: "internet" as const,
      scannerName: "qa-hipaa-operational",
      currentFindingStatus: "open" as const,
      regulatedFrameworks: ["hipaa"],
      metadata: { regulatedFrameworks: ["hipaa"] },
    };

    const decisionOutput = await evaluateDecision(decisionInput);
    assert(decisionOutput.requiresApproval, "Expected requiresApproval=true for HIPAA signal");
    assert(
      Boolean(decisionOutput.metadata?.hipaaStrictReview),
      "Expected metadata.hipaaStrictReview=true for HIPAA signal"
    );

    const { data: policyDecision, error: policyError } = await supabase
      .from("policy_decisions")
      .insert({
        tenant_id: tenantId,
        finding_id: findingId,
        remediation_action_id: null,
        policy_id: null,
        decision_type: "finding_triage",
        decision_result: mapDecisionResult(decisionOutput),
        reason: decisionOutput.reasonCodes.join(", "),
        input_payload: decisionInput,
        output_payload: decisionOutput,
      })
      .select("id")
      .single();
    if (policyError || !policyDecision?.id) {
      throw new Error(`Could not create policy_decisions row: ${policyError?.message ?? "unknown error"}`);
    }
    policyDecisionId = policyDecision.id as string;

    const hookResult = await runComplianceAgentHook({
      tenantId,
      scanRunId: runId,
      workflowRunId,
      findingId,
      findingCategory: "hipaa ephi health privacy access",
      findingTitle: "QA HIPAA ePHI strict review signal",
      severity: "high",
      decisionOutput,
      policyDecisionId,
    });

    const { data: mappings, error: mappingsError } = await supabase
      .from("finding_control_mappings")
      .select("id, control_requirement:control_requirements!inner(control_code, framework:control_frameworks!inner(framework_code))")
      .eq("tenant_id", tenantId)
      .eq("finding_id", findingId);
    if (mappingsError) throw new Error(`Could not read finding_control_mappings: ${mappingsError.message}`);

    const hipaaMappings = (mappings ?? []).filter((row: any) => {
      const framework = Array.isArray(row.control_requirement?.framework)
        ? row.control_requirement.framework[0]?.framework_code
        : row.control_requirement?.framework?.framework_code;
      return framework === "HIPAA";
    });

    const { data: evidence, error: evidenceError } = await supabase
      .from("evidence_records")
      .select("id, control_framework, control_id")
      .eq("tenant_id", tenantId)
      .eq("finding_id", findingId);
    if (evidenceError) throw new Error(`Could not read evidence_records: ${evidenceError.message}`);

    const hipaaEvidence = (evidence ?? []).filter((row) => String(row.control_framework).toLowerCase() === "hipaa");

    assert(hipaaMappings.length > 0, "Expected HIPAA control mappings from compliance hook");
    assert(hipaaEvidence.length > 0, "Expected HIPAA evidence records from compliance hook");

    console.info(
      JSON.stringify(
        {
          ok: true,
          tenantId,
          runId,
          findingId,
          policyDecisionId,
          decision: {
            action: decisionOutput.action,
            requiresApproval: decisionOutput.requiresApproval,
            hipaaStrictReview: decisionOutput.metadata?.hipaaStrictReview ?? false,
            reasonCodes: decisionOutput.reasonCodes,
          },
          hook: hookResult,
          mappedHipaaControls: hipaaMappings.length,
          hipaaEvidenceRecords: hipaaEvidence.length,
        },
        null,
        2
      )
    );
  } finally {
    // Cleanup synthetic QA rows (best-effort).
    if (policyDecisionId) {
      await supabase.from("policy_decisions").delete().eq("id", policyDecisionId);
    }
    await supabase.from("finding_control_mappings").delete().eq("tenant_id", tenantId).eq("finding_id", findingId);
    await supabase.from("evidence_records").delete().eq("tenant_id", tenantId).eq("finding_id", findingId);
    await supabase.from("findings").delete().eq("id", findingId);
    await supabase.from("scan_runs").delete().eq("id", runId);
  }
}

main().catch((error) => {
  console.error("[qa-hipaa-operational] FAIL:", error instanceof Error ? error.message : error);
  process.exit(1);
});
