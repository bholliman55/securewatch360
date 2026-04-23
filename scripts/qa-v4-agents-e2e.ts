import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { inngest } from "../src/inngest/client";
import { getSupabaseAdminClient } from "../src/lib/supabase";
import { evaluateDecision } from "../src/lib/decisionEngine";
import { routeRemediationCandidate } from "../src/lib/remediationAgent";

loadEnvConfig(process.cwd());

const DEFAULT_SEEDED_TENANT_ID = "8c2b980c-9fc8-4b71-9b5f-2e90a5c3a001";
const DEFAULT_DEV_INNGEST_EVENT_KEY = "dev-local-key";

type ScanRunRow = {
  id: string;
  status: string;
  error_message: string | null;
  created_at: string;
  scanner_type: string | null;
};

type FindingRow = {
  id: string;
  severity: string;
  title: string;
  decision_input: Record<string, unknown> | null;
  decision_result: Record<string, unknown> | null;
  compliance_impact: string | null;
  compliance_context: Record<string, unknown> | null;
};

type TestStatus = "passed" | "failed" | "skipped";

type TestResult = {
  id: string;
  title: string;
  status: TestStatus;
  durationMs: number;
  details: string[];
  error?: string;
};

type RunContext = {
  tenantId: string;
  maxAttempts: number;
  pollIntervalMs: number;
  scanTargetId?: string;
  scanRunId?: string;
  findingIds?: string[];
  alertRunId?: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0);
}

function mapDecisionResultForPolicyDecision(action: string, requiresApproval: boolean): string {
  if (action === "block") return "deny";
  if (requiresApproval) return "require_approval";
  if (action === "request_risk_acceptance") return "defer";
  return "allow";
}

async function runTest(
  id: string,
  title: string,
  fn: () => Promise<{ details: string[]; skipped?: boolean }>
): Promise<TestResult> {
  const start = Date.now();
  try {
    const out = await fn();
    return {
      id,
      title,
      status: out.skipped ? "skipped" : "passed",
      durationMs: Date.now() - start,
      details: out.details,
    };
  } catch (error) {
    return {
      id,
      title,
      status: "failed",
      durationMs: Date.now() - start,
      details: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function createQaScanTarget(ctx: RunContext): Promise<{ details: string[] }> {
  const supabase = getSupabaseAdminClient();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const targetName = `qa-v4-agents-target-${timestamp}`;

  const { data, error } = await supabase
    .from("scan_targets")
    .insert({
      tenant_id: ctx.tenantId,
      target_name: targetName,
      target_type: "url",
      target_value: "https://qa-v4-agents.securewatch.local",
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create QA scan target: ${error?.message ?? "unknown error"}`);
  }

  ctx.scanTargetId = data.id as string;
  return {
    details: [`scanTargetId=${ctx.scanTargetId}`, `targetName=${targetName}`],
  };
}

async function triggerAndWaitForScanWorkflow(ctx: RunContext): Promise<{ details: string[] }> {
  assert(ctx.scanTargetId, "scanTargetId not set before scan trigger");
  const supabase = getSupabaseAdminClient();
  const startedAfterIso = new Date().toISOString();

  await inngest.send({
    name: "securewatch/scan.requested",
    data: {
      tenantId: ctx.tenantId,
      scanTargetId: ctx.scanTargetId,
    },
  });

  let latestStatus = "not_found";

  for (let attempt = 1; attempt <= ctx.maxAttempts; attempt++) {
    const { data, error } = await supabase
      .from("scan_runs")
      .select("id, status, error_message, created_at, scanner_type")
      .eq("tenant_id", ctx.tenantId)
      .eq("scan_target_id", ctx.scanTargetId)
      .gte("created_at", startedAfterIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed polling scan_runs: ${error.message}`);
    }

    if (data) {
      latestStatus = data.status;
      if (data.status === "completed") {
        ctx.scanRunId = data.id as string;
        return {
          details: [
            `scanRunId=${ctx.scanRunId}`,
            `status=${data.status}`,
            `scanner_type=${data.scanner_type ?? "unknown"}`,
          ],
        };
      }

      if (data.status === "failed" || data.status === "cancelled") {
        throw new Error(
          `Scan run reached failure state status=${data.status} runId=${data.id} error=${data.error_message ?? "none"}`
        );
      }
    }

    if (attempt < ctx.maxAttempts) {
      await sleep(ctx.pollIntervalMs);
    }
  }

  throw new Error(`Timed out waiting for completed scan run. Last seen status=${latestStatus}`);
}

async function validateDecisioningAgentArtifacts(ctx: RunContext): Promise<{ details: string[] }> {
  assert(ctx.scanRunId, "scanRunId not set before decisioning validation");
  const supabase = getSupabaseAdminClient();

  const { data: findings, error: findingsError } = await supabase
    .from("findings")
    .select("id, severity, title, decision_input, decision_result, compliance_impact, compliance_context")
    .eq("tenant_id", ctx.tenantId)
    .eq("scan_run_id", ctx.scanRunId);

  if (findingsError) {
    throw new Error(`Failed reading findings for run ${ctx.scanRunId}: ${findingsError.message}`);
  }

  const findingRows = (findings ?? []) as FindingRow[];
  assert(findingRows.length > 0, `No findings produced for run ${ctx.scanRunId}`);
  ctx.findingIds = findingRows.map((row) => row.id);

  const missingDecisionInput = findingRows.filter((row) => !isNonEmptyObject(row.decision_input));
  const missingDecisionResult = findingRows.filter((row) => !isNonEmptyObject(row.decision_result));

  assert(
    missingDecisionInput.length === 0,
    `Missing decision_input for findings: ${missingDecisionInput.map((row) => row.id).join(", ")}`
  );
  assert(
    missingDecisionResult.length === 0,
    `Missing decision_result for findings: ${missingDecisionResult.map((row) => row.id).join(", ")}`
  );

  const { data: policyDecisions, error: policyDecisionError } = await supabase
    .from("policy_decisions")
    .select("id, finding_id")
    .eq("tenant_id", ctx.tenantId)
    .in("finding_id", ctx.findingIds);

  if (policyDecisionError) {
    throw new Error(`Failed reading policy_decisions: ${policyDecisionError.message}`);
  }

  const coveredFindingIds = new Set(
    (policyDecisions ?? [])
      .map((row) => row.finding_id as string | null)
      .filter((id): id is string => Boolean(id))
  );
  assert(
    coveredFindingIds.size === ctx.findingIds.length,
    `Policy decision coverage mismatch. findings=${ctx.findingIds.length} covered=${coveredFindingIds.size}`
  );

  return {
    details: [
      `findings=${findingRows.length}`,
      `policyDecisions=${policyDecisions?.length ?? 0}`,
      `coverage=${coveredFindingIds.size}/${ctx.findingIds.length}`,
    ],
  };
}

async function validateComplianceAgentArtifacts(ctx: RunContext): Promise<{ details: string[] }> {
  assert(ctx.findingIds && ctx.findingIds.length > 0, "findingIds not set before compliance validation");
  const supabase = getSupabaseAdminClient();

  const { data: findings, error: findingsError } = await supabase
    .from("findings")
    .select("id, compliance_impact, compliance_context")
    .eq("tenant_id", ctx.tenantId)
    .in("id", ctx.findingIds);

  if (findingsError) {
    throw new Error(`Failed reading findings for compliance validation: ${findingsError.message}`);
  }

  const rows = (findings ?? []) as Array<{
    id: string;
    compliance_impact: string | null;
    compliance_context: Record<string, unknown> | null;
  }>;

  const missingImpact = rows.filter((row) => !row.compliance_impact);
  assert(
    missingImpact.length === 0,
    `Compliance impact missing for findings: ${missingImpact.map((row) => row.id).join(", ")}`
  );

  const withContext = rows.filter((row) => isNonEmptyObject(row.compliance_context));

  const { data: mappings, error: mappingsError } = await supabase
    .from("finding_control_mappings")
    .select("id, finding_id")
    .eq("tenant_id", ctx.tenantId)
    .in("finding_id", ctx.findingIds);

  if (mappingsError) {
    throw new Error(`Failed reading finding_control_mappings: ${mappingsError.message}`);
  }

  const { data: evidence, error: evidenceError } = await supabase
    .from("evidence_records")
    .select("id, finding_id, evidence_type")
    .eq("tenant_id", ctx.tenantId)
    .eq("scan_run_id", ctx.scanRunId as string)
    .in("finding_id", ctx.findingIds);

  if (evidenceError) {
    throw new Error(`Failed reading evidence_records: ${evidenceError.message}`);
  }

  return {
    details: [
      `findingsWithComplianceImpact=${rows.length}`,
      `findingsWithComplianceContext=${withContext.length}`,
      `controlMappings=${mappings?.length ?? 0}`,
      `evidenceRecords=${evidence?.length ?? 0}`,
    ],
  };
}

async function validateRemediationAgentArtifacts(
  ctx: RunContext
): Promise<{ details: string[]; skipped?: boolean }> {
  assert(ctx.findingIds && ctx.findingIds.length > 0, "findingIds not set before remediation validation");
  const supabase = getSupabaseAdminClient();

  const { data: remediations, error: remediationError } = await supabase
    .from("remediation_actions")
    .select("id, finding_id, action_type, action_status, execution_status, execution_mode, execution_payload")
    .eq("tenant_id", ctx.tenantId)
    .in("finding_id", ctx.findingIds);

  if (remediationError) {
    throw new Error(`Failed reading remediation_actions: ${remediationError.message}`);
  }

  const rows = remediations ?? [];
  if (rows.length === 0) {
    return {
      skipped: true,
      details: ["No remediation actions created in this run (likely monitor_only outcomes)."],
    };
  }

  const invalidExecution = rows.filter(
    (row) =>
      !row.execution_status ||
      !row.execution_mode ||
      !row.action_status ||
      !isNonEmptyObject(row.execution_payload)
  );
  assert(
    invalidExecution.length === 0,
    `Invalid remediation execution fields for action IDs: ${invalidExecution.map((row) => row.id).join(", ")}`
  );

  return {
    details: [
      `remediationActions=${rows.length}`,
      `executionFieldsValidated=${rows.length}`,
      `actionTypes=${Array.from(new Set(rows.map((row) => String(row.action_type)))).join(",")}`,
    ],
  };
}

async function validateApprovalAgentArtifacts(ctx: RunContext): Promise<{ details: string[]; skipped?: boolean }> {
  assert(ctx.findingIds && ctx.findingIds.length > 0, "findingIds not set before approval validation");
  const supabase = getSupabaseAdminClient();

  const { data: approvalRows, error: approvalError } = await supabase
    .from("approval_requests")
    .select("id, finding_id, remediation_action_id, status")
    .eq("tenant_id", ctx.tenantId)
    .in("finding_id", ctx.findingIds);

  if (approvalError) {
    throw new Error(`Failed reading approval_requests: ${approvalError.message}`);
  }

  let rows = approvalRows ?? [];
  if (rows.length === 0) {
    const now = new Date().toISOString();

    const { data: targetRow, error: targetError } = await supabase
      .from("scan_targets")
      .insert({
        tenant_id: ctx.tenantId,
        target_name: `qa-approval-path-${now.replace(/[:.]/g, "-")}`,
        target_type: "url",
        target_value: "https://qa-approval.securewatch.local",
        status: "active",
      })
      .select("id, target_type, target_value")
      .single();
    if (targetError || !targetRow) {
      throw new Error(`Failed creating approval-path scan target: ${targetError?.message ?? "unknown error"}`);
    }

    const { data: runRow, error: runError } = await supabase
      .from("scan_runs")
      .insert({
        tenant_id: ctx.tenantId,
        scan_target_id: targetRow.id,
        workflow_run_id: `qa-approval-path-${Date.now()}`,
        status: "running",
        started_at: now,
      })
      .select("id")
      .single();
    if (runError || !runRow) {
      throw new Error(`Failed creating approval-path scan run: ${runError?.message ?? "unknown error"}`);
    }

    const { data: findingRow, error: findingError } = await supabase
      .from("findings")
      .insert({
        tenant_id: ctx.tenantId,
        scan_run_id: runRow.id,
        severity: "critical",
        category: "network-exposure",
        title: "QA forced approval path finding",
        description: "Synthetic finding to validate approval workflow branch.",
        evidence: {
          source: "qa-v4-agents-e2e",
          synthetic: true,
        },
        status: "open",
        asset_type: targetRow.target_type,
        exposure: "internet",
        priority_score: 100,
      })
      .select("id, severity, category, title")
      .single();
    if (findingError || !findingRow) {
      throw new Error(`Failed creating approval-path finding: ${findingError?.message ?? "unknown error"}`);
    }

    const decisionInput = {
      tenantId: ctx.tenantId,
      findingId: findingRow.id as string,
      severity: "critical" as const,
      category: findingRow.category as string,
      assetType: targetRow.target_type as string,
      targetType: targetRow.target_type as string,
      exposure: "internet" as const,
      scannerName: "qa-v4-agents-e2e",
      currentFindingStatus: "open" as const,
    };
    const decisionOutput = await evaluateDecision(decisionInput);
    if (!decisionOutput.requiresApproval) {
      throw new Error(
        `Forced approval-path decision did not require approval. action=${decisionOutput.action} reasonCodes=${decisionOutput.reasonCodes.join(",")}`
      );
    }

    const policyDecisionResult = mapDecisionResultForPolicyDecision(
      decisionOutput.action,
      decisionOutput.requiresApproval
    );
    const { data: policyDecisionRow, error: policyDecisionError } = await supabase
      .from("policy_decisions")
      .insert({
        tenant_id: ctx.tenantId,
        finding_id: findingRow.id,
        remediation_action_id: null,
        policy_id: null,
        decision_type: "finding_triage",
        decision_result: policyDecisionResult,
        reason: decisionOutput.reasonCodes.join(", "),
        input_payload: decisionInput,
        output_payload: decisionOutput,
      })
      .select("id")
      .single();
    if (policyDecisionError || !policyDecisionRow) {
      throw new Error(
        `Failed creating approval-path policy decision: ${policyDecisionError?.message ?? "unknown error"}`
      );
    }

    const { error: findingUpdateError } = await supabase
      .from("findings")
      .update({
        decision_input: decisionInput,
        decision_result: decisionOutput,
        approval_status: "pending",
        exception_status: decisionOutput.action === "request_risk_acceptance" ? "requested" : "none",
        updated_at: new Date().toISOString(),
      })
      .eq("id", findingRow.id);
    if (findingUpdateError) {
      throw new Error(`Failed updating approval-path finding decision fields: ${findingUpdateError.message}`);
    }

    const routed = await routeRemediationCandidate({
      tenantId: ctx.tenantId,
      findingId: findingRow.id as string,
      scanRunId: runRow.id as string,
      workflowRunId: `qa-approval-path-${Date.now()}`,
      policyDecisionId: policyDecisionRow.id as string,
      decisionInput,
      decisionOutput,
      severity: "critical",
      category: (findingRow.category as string) ?? "network-exposure",
      title: findingRow.title as string,
      targetType: targetRow.target_type as string,
      targetValue: targetRow.target_value as string,
      exposure: "internet",
      requiresApproval: true,
      approvalStatus: "pending",
      exceptionStatus: decisionOutput.action === "request_risk_acceptance" ? "requested" : "none",
    });

    const { error: createApprovalError } = await supabase.from("approval_requests").insert({
      tenant_id: ctx.tenantId,
      finding_id: findingRow.id,
      remediation_action_id: routed.remediationActionId,
      requested_by_user_id: null,
      assigned_approver_user_id: null,
      approval_type: "remediation_execution",
      status: "pending",
      reason: "QA forced approval path",
      request_payload: {
        decisionInput,
        decisionOutput,
      },
      response_payload: {},
      updated_at: new Date().toISOString(),
    });
    if (createApprovalError) {
      throw new Error(`Failed creating approval-path approval_request: ${createApprovalError.message}`);
    }

    const { data: refreshed, error: refreshedError } = await supabase
      .from("approval_requests")
      .select("id, finding_id, remediation_action_id, status")
      .eq("tenant_id", ctx.tenantId)
      .eq("finding_id", findingRow.id);
    if (refreshedError) {
      throw new Error(`Failed reading forced approval requests: ${refreshedError.message}`);
    }
    rows = refreshed ?? [];

    ctx.findingIds = Array.from(new Set([...(ctx.findingIds ?? []), findingRow.id as string]));

    if (rows.length === 0) {
      throw new Error("Approval path forcing executed but no approval_requests were persisted.");
    }

    const invalidRows = rows.filter((row) => !row.status || !row.remediation_action_id);
    assert(
      invalidRows.length === 0,
      `Approval rows missing expected fields: ${invalidRows.map((row) => row.id).join(", ")}`
    );

    return {
      details: [
        "No natural approval rows found; executed forced approval-path branch.",
        `approvalRequests=${rows.length}`,
        `statuses=${Array.from(new Set(rows.map((row) => row.status))).join(",")}`,
      ],
    };
  }

  const invalidRows = rows.filter((row) => !row.status || !row.remediation_action_id);
  assert(
    invalidRows.length === 0,
    `Approval rows missing expected fields: ${invalidRows.map((row) => row.id).join(", ")}`
  );

  return {
    details: [`approvalRequests=${rows.length}`, `statuses=${Array.from(new Set(rows.map((row) => row.status))).join(",")}`],
  };
}

async function validateMonitoringWorkflowAgent(ctx: RunContext): Promise<{ details: string[] }> {
  const supabase = getSupabaseAdminClient();
  const startedAfterIso = new Date().toISOString();

  await inngest.send({
    name: "securewatch/monitoring.alert.received",
    data: {
      tenantId: ctx.tenantId,
      source: "qa-v4-agents",
      alertType: "suspicious-login",
      severity: "high",
      title: "QA monitoring alert",
      description: "Generated by qa-v4-agents-e2e script",
      targetValue: "qa-monitoring-target.securewatch.local",
      createFinding: true,
      metadata: {
        harness: "qa-v4-agents-e2e",
      },
    },
  });

  let runRow: ScanRunRow | null = null;
  for (let attempt = 1; attempt <= ctx.maxAttempts; attempt++) {
    const { data, error } = await supabase
      .from("scan_runs")
      .select("id, status, error_message, created_at, scanner_type")
      .eq("tenant_id", ctx.tenantId)
      .eq("scanner_type", "monitoring")
      .gte("created_at", startedAfterIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed polling monitoring scan_runs: ${error.message}`);
    }
    if (data) {
      runRow = data as ScanRunRow;
      if (runRow.status === "completed") {
        break;
      }
      if (runRow.status === "failed" || runRow.status === "cancelled") {
        throw new Error(
          `Monitoring run failed status=${runRow.status} runId=${runRow.id} error=${runRow.error_message ?? "none"}`
        );
      }
    }

    if (attempt < ctx.maxAttempts) {
      await sleep(ctx.pollIntervalMs);
    }
  }

  assert(runRow?.id, "Monitoring workflow run not found");
  assert(runRow.status === "completed", `Monitoring run did not complete. status=${runRow.status}`);
  ctx.alertRunId = runRow.id;

  const { data: findings, error: findingsError } = await supabase
    .from("findings")
    .select("id, scan_run_id, title")
    .eq("tenant_id", ctx.tenantId)
    .eq("scan_run_id", runRow.id);

  if (findingsError) {
    throw new Error(`Failed reading monitoring findings: ${findingsError.message}`);
  }
  assert((findings ?? []).length > 0, `No monitoring finding created for runId=${runRow.id}`);

  return {
    details: [`monitoringRunId=${runRow.id}`, `monitoringFindings=${(findings ?? []).length}`],
  };
}

function renderReport(runId: string, ctx: RunContext, results: TestResult[]): string {
  const total = results.length;
  const passed = results.filter((r) => r.status === "passed").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;

  const lines: string[] = [];
  lines.push("# SecureWatch360 Agent E2E Report");
  lines.push("");
  lines.push(`- runId: \`${runId}\``);
  lines.push(`- tenantId: \`${ctx.tenantId}\``);
  lines.push(`- summary: passed=${passed}, failed=${failed}, skipped=${skipped}, total=${total}`);
  lines.push("");
  lines.push("## Tests Executed");
  lines.push("");

  for (const result of results) {
    lines.push(`### ${result.id} - ${result.title}`);
    lines.push(`- status: \`${result.status}\``);
    lines.push(`- durationMs: \`${result.durationMs}\``);
    if (result.details.length > 0) {
      for (const detail of result.details) {
        lines.push(`- detail: ${detail}`);
      }
    }
    if (result.error) {
      lines.push(`- error: ${result.error}`);
    }
    lines.push("");
  }

  lines.push("## Agent Coverage");
  lines.push("");
  lines.push("- Decisioning Agent: `evaluateDecision()` + `policy_decisions` assertions");
  lines.push("- Compliance Agent: `runComplianceAgentHook()` outputs on findings/mappings/evidence");
  lines.push("- Remediation Agent: `routeRemediationCandidate()` output fields on `remediation_actions`");
  lines.push("- Approval Workflow Agent: `approval_requests` generation checks");
  lines.push("- Monitoring Workflow Agent: `securewatch/monitoring.alert.received` run + finding");
  lines.push("");

  return lines.join("\n");
}

async function main() {
  const tenantId = process.env.TEST_TENANT_ID?.trim() || DEFAULT_SEEDED_TENANT_ID;
  if (!process.env.INNGEST_EVENT_KEY?.trim()) {
    process.env.INNGEST_EVENT_KEY = DEFAULT_DEV_INNGEST_EVENT_KEY;
  }
  const maxAttempts = Number(process.env.QA_MAX_ATTEMPTS ?? 20);
  const pollIntervalMs = Number(process.env.QA_POLL_INTERVAL_MS ?? 3000);

  const ctx: RunContext = {
    tenantId: tenantId ?? "unset",
    maxAttempts,
    pollIntervalMs,
  };

  const runId = `qa-v4-agents-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const tests: Array<{ id: string; title: string; fn: () => Promise<{ details: string[]; skipped?: boolean }> }> = [
    {
      id: "T00",
      title: "Preflight environment validation",
      fn: async () => {
        assert(process.env.NEXT_PUBLIC_SUPABASE_URL, "Missing NEXT_PUBLIC_SUPABASE_URL");
        assert(process.env.SUPABASE_SERVICE_ROLE_KEY, "Missing SUPABASE_SERVICE_ROLE_KEY");
        assert(Number.isInteger(maxAttempts) && maxAttempts > 0, "QA_MAX_ATTEMPTS must be a positive integer.");
        assert(
          Number.isInteger(pollIntervalMs) && pollIntervalMs >= 500,
          "QA_POLL_INTERVAL_MS must be an integer >= 500."
        );
        return {
          details: [
            "Environment values required for E2E execution are present.",
            process.env.TEST_TENANT_ID?.trim()
              ? "tenantId source=TEST_TENANT_ID"
              : `tenantId source=default-seed (${DEFAULT_SEEDED_TENANT_ID})`,
            process.env.INNGEST_EVENT_KEY === DEFAULT_DEV_INNGEST_EVENT_KEY
              ? "inngest event key source=default-dev-placeholder"
              : "inngest event key source=env",
            `tenantId=${tenantId}`,
            `maxAttempts=${maxAttempts}`,
            `pollIntervalMs=${pollIntervalMs}`,
          ],
        };
      },
    },
    { id: "T01", title: "Create QA scan target", fn: () => createQaScanTarget(ctx) },
    { id: "T02", title: "Trigger scan workflow and wait for completion", fn: () => triggerAndWaitForScanWorkflow(ctx) },
    { id: "T03", title: "Validate decisioning agent artifacts", fn: () => validateDecisioningAgentArtifacts(ctx) },
    { id: "T04", title: "Validate compliance agent artifacts", fn: () => validateComplianceAgentArtifacts(ctx) },
    { id: "T05", title: "Validate remediation agent artifacts", fn: () => validateRemediationAgentArtifacts(ctx) },
    { id: "T06", title: "Validate approval workflow artifacts", fn: () => validateApprovalAgentArtifacts(ctx) },
    { id: "T07", title: "Validate monitoring workflow agent", fn: () => validateMonitoringWorkflowAgent(ctx) },
  ];

  const results: TestResult[] = [];
  for (const test of tests) {
    const result = await runTest(test.id, test.title, test.fn);
    results.push(result);
    const outcome = result.status.toUpperCase();
    const suffix = result.error ? ` | ${result.error}` : "";
    console.log(`[qa-v4-agents] ${outcome} ${test.id} ${test.title}${suffix}`);
    if (result.status === "failed") {
      break;
    }
  }

  const reportDir = join(process.cwd(), "docs", "reports");
  mkdirSync(reportDir, { recursive: true });
  const reportMarkdown = renderReport(runId, ctx, results);
  const reportPath = join(reportDir, `agent-e2e-${runId}.md`);
  const latestPath = join(reportDir, "agent-e2e-latest.md");
  const jsonPath = join(reportDir, `agent-e2e-${runId}.json`);
  const latestJsonPath = join(reportDir, "agent-e2e-latest.json");

  writeFileSync(reportPath, reportMarkdown, "utf8");
  writeFileSync(latestPath, reportMarkdown, "utf8");
  const jsonPayload = JSON.stringify({ runId, context: ctx, results }, null, 2);
  writeFileSync(jsonPath, jsonPayload, "utf8");
  writeFileSync(latestJsonPath, jsonPayload, "utf8");

  const hasFailures = results.some((result) => result.status === "failed");
  if (hasFailures) {
    throw new Error(
      `Agent E2E failed. See report: ${reportPath.replace(process.cwd(), ".")} and ${jsonPath.replace(process.cwd(), ".")}`
    );
  }

  console.log(`[qa-v4-agents] PASS - report written to ${reportPath.replace(process.cwd(), ".")}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[qa-v4-agents] FAIL: ${message}`);
  process.exit(1);
});
