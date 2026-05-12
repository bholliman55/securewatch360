import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { getSupabaseAdminClient } from "../src/lib/supabase";
import { evaluateDecisionWithRules } from "../src/lib/decisionEngine";
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

const CASES = [
  { framework: "soc2", category: "soc2 trust services access control", title: "QA SOC2 strict review signal" },
  { framework: "cmmc", category: "cmmc cui exposure defense boundary", title: "QA CMMC strict review signal" },
  { framework: "nist", category: "nist 800-53 control enforcement gap", title: "QA NIST strict review signal" },
  { framework: "iso27001", category: "iso 27001 annex a policy gap", title: "QA ISO27001 strict review signal" },
  { framework: "pci_dss", category: "pci cardholder payment data issue", title: "QA PCI DSS strict review signal" },
  { framework: "cis", category: "cis controls benchmark drift", title: "QA CIS strict review signal" },
  { framework: "gdpr", category: "gdpr personal data processing issue", title: "QA GDPR strict review signal" },
  { framework: "fedramp", category: "fedramp fisma boundary issue", title: "QA FedRAMP strict review signal" },
  { framework: "ccpa", category: "ccpa california consumer data issue", title: "QA CCPA strict review signal" },
  { framework: "cobit", category: "cobit governance control issue", title: "QA COBIT strict review signal" },
] as const;

async function main() {
  const tenantId = process.env.TEST_TENANT_ID?.trim();
  assert(tenantId, "Missing TEST_TENANT_ID");
  const supabase = getSupabaseAdminClient();

  const { data: target, error: targetError } = await supabase
    .from("scan_targets")
    .select("id, target_type, target_value")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (targetError) throw new Error(`Could not load scan target: ${targetError.message}`);
  assert(target?.id, "No active scan target found for TEST_TENANT_ID");

  const scanRunIds: string[] = [];
  const findingIds: string[] = [];
  const policyDecisionIds: string[] = [];

  try {
    const results: Array<Record<string, unknown>> = [];
    for (const testCase of CASES) {
      const runId = randomUUID();
      const findingId = randomUUID();
      scanRunIds.push(runId);
      findingIds.push(findingId);

      const workflowRunId = `qa-frameworks-compliance-${testCase.framework}-${Date.now()}`;
      const { error: runError } = await supabase.from("scan_runs").insert({
        id: runId,
        tenant_id: tenantId,
        scan_target_id: target.id,
        workflow_run_id: workflowRunId,
        status: "completed",
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        scanner_name: "qa-frameworks-compliance-operational",
        scanner_type: "mock",
      });
      if (runError) throw new Error(`[${testCase.framework}] Could not create scan_run: ${runError.message}`);

      const { error: findingError } = await supabase.from("findings").insert({
        id: findingId,
        tenant_id: tenantId,
        scan_run_id: runId,
        severity: "high",
        category: testCase.category,
        title: testCase.title,
        description: "Synthetic finding to prove framework compliance operational wiring.",
        evidence: { source: "qa-frameworks-compliance-operational", framework: testCase.framework },
        status: "open",
        asset_type: target.target_type,
        exposure: "internet",
        priority_score: 85,
      });
      if (findingError) throw new Error(`[${testCase.framework}] Could not create finding: ${findingError.message}`);

      const decisionInput = {
        tenantId,
        findingId,
        severity: "high" as const,
        category: testCase.category,
        assetType: target.target_type as string,
        targetType: target.target_type as string,
        exposure: "internet" as const,
        scannerName: "qa-frameworks-compliance-operational",
        currentFindingStatus: "open" as const,
        regulatedFrameworks: [testCase.framework],
        metadata: { regulatedFrameworks: [testCase.framework] },
      };
      const decisionOutput = await evaluateDecisionWithRules(decisionInput);
      assert(decisionOutput.requiresApproval, `[${testCase.framework}] expected requiresApproval=true`);

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
        throw new Error(`[${testCase.framework}] Could not create policy_decisions row: ${policyError?.message}`);
      }
      policyDecisionIds.push(policyDecision.id as string);

      await runComplianceAgentHook({
        tenantId,
        scanRunId: runId,
        workflowRunId,
        findingId,
        findingCategory: testCase.category,
        findingTitle: testCase.title,
        severity: "high",
        decisionOutput,
        policyDecisionId: policyDecision.id as string,
      });

      const { data: mappings, error: mappingsError } = await supabase
        .from("finding_control_mappings")
        .select(
          "id, control_requirement:control_requirements!inner(control_code, framework:control_frameworks!inner(framework_code))"
        )
        .eq("tenant_id", tenantId)
        .eq("finding_id", findingId);
      if (mappingsError) throw new Error(`[${testCase.framework}] Could not read mappings: ${mappingsError.message}`);

      const frameworkCode = testCase.framework === "pci_dss" ? "PCI_DSS" : testCase.framework.toUpperCase();
      const frameworkMappings = (mappings ?? []).filter((row: any) => {
        const framework = Array.isArray(row.control_requirement?.framework)
          ? row.control_requirement.framework[0]?.framework_code
          : row.control_requirement?.framework?.framework_code;
        return framework === frameworkCode;
      });
      assert(frameworkMappings.length > 0, `[${testCase.framework}] expected framework control mappings`);

      const { data: evidence, error: evidenceError } = await supabase
        .from("evidence_records")
        .select("id, control_framework, control_id")
        .eq("tenant_id", tenantId)
        .eq("finding_id", findingId);
      if (evidenceError) throw new Error(`[${testCase.framework}] Could not read evidence: ${evidenceError.message}`);

      const evidenceFramework = testCase.framework === "pci_dss" ? "pci_dss" : testCase.framework;
      const frameworkEvidence = (evidence ?? []).filter(
        (row) => String(row.control_framework).toLowerCase() === evidenceFramework
      );
      assert(frameworkEvidence.length > 0, `[${testCase.framework}] expected framework evidence records`);

      results.push({
        framework: testCase.framework,
        mappedControls: frameworkMappings.length,
        evidenceRecords: frameworkEvidence.length,
        decisionAction: decisionOutput.action,
      });
    }

    console.info(
      JSON.stringify(
        {
          ok: true,
          frameworksChecked: CASES.length,
          results,
        },
        null,
        2
      )
    );
  } finally {
    for (const id of policyDecisionIds) {
      await supabase.from("policy_decisions").delete().eq("id", id);
    }
    if (findingIds.length > 0) {
      await supabase.from("finding_control_mappings").delete().eq("tenant_id", tenantId).in("finding_id", findingIds);
      await supabase.from("evidence_records").delete().eq("tenant_id", tenantId).in("finding_id", findingIds);
      await supabase.from("findings").delete().in("id", findingIds);
    }
    if (scanRunIds.length > 0) {
      await supabase.from("scan_runs").delete().in("id", scanRunIds);
    }
  }
}

main().catch((error) => {
  console.error(
    "[qa-frameworks-compliance-operational] FAIL:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
