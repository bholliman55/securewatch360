import { inngest } from "../src/inngest/client";
import { getSupabaseAdminClient } from "../src/lib/supabase";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const DEFAULT_SEEDED_TENANT_ID = "8c2b980c-9fc8-4b71-9b5f-2e90a5c3a001";
const DEFAULT_DEV_INNGEST_EVENT_KEY = "dev-local-key";

type ScanRunRow = {
  id: string;
  status: string;
  error_message: string | null;
  created_at: string;
};

type FindingRow = {
  id: string;
  severity: string;
  title: string;
  decision_input: Record<string, unknown>;
  decision_result: Record<string, unknown>;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0);
}

async function createQaScanTarget(tenantId: string): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const targetName = `qa-v4-target-${timestamp}`;

  const { data, error } = await supabase
    .from("scan_targets")
    .insert({
      tenant_id: tenantId,
      target_name: targetName,
      target_type: "url",
      target_value: "https://qa-v4.securewatch.local",
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create QA scan target: ${error?.message ?? "unknown error"}`);
  }

  return data.id as string;
}

async function triggerScanWorkflow(tenantId: string, scanTargetId: string) {
  try {
    await inngest.send({
      name: "securewatch/scan.requested",
      data: { tenantId, scanTargetId },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    throw new Error(
      `Failed to send securewatch/scan.requested event. Ensure INNGEST_EVENT_KEY is set and Inngest is reachable. Details: ${message}`
    );
  }
}

async function waitForRunCompletion(
  tenantId: string,
  scanTargetId: string,
  startedAfterIso: string,
  maxAttempts: number,
  intervalMs: number
): Promise<ScanRunRow> {
  const supabase = getSupabaseAdminClient();
  let lastSeenStatus = "not_found";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data, error } = await supabase
      .from("scan_runs")
      .select("id, status, error_message, created_at")
      .eq("tenant_id", tenantId)
      .eq("scan_target_id", scanTargetId)
      .gte("created_at", startedAfterIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed reading scan_runs while polling: ${error.message}`);
    }

    if (data) {
      lastSeenStatus = data.status;
      console.log(`[qa-v4] poll ${attempt}/${maxAttempts}: run=${data.id} status=${data.status}`);
      if (data.status === "completed") {
        return data as ScanRunRow;
      }
      if (data.status === "failed" || data.status === "cancelled") {
        throw new Error(
          `Scan run reached terminal failure state (status=${data.status}, runId=${data.id}, error=${data.error_message ?? "none"})`
        );
      }
    } else {
      console.log(`[qa-v4] poll ${attempt}/${maxAttempts}: run not visible yet`);
    }

    if (attempt < maxAttempts) {
      await sleep(intervalMs);
    }
  }

  throw new Error(
    `Timed out waiting for completed scan run for scanTargetId=${scanTargetId}. Last seen status=${lastSeenStatus}. Increase QA_MAX_ATTEMPTS or QA_POLL_INTERVAL_MS if needed.`
  );
}

async function verifyV4Artifacts(tenantId: string, runId: string) {
  const supabase = getSupabaseAdminClient();

  const { data: findings, error: findingsError } = await supabase
    .from("findings")
    .select("id, severity, title, decision_input, decision_result")
    .eq("tenant_id", tenantId)
    .eq("scan_run_id", runId);

  if (findingsError) {
    throw new Error(`Failed reading findings for run ${runId}: ${findingsError.message}`);
  }

  const findingRows = (findings ?? []) as FindingRow[];
  assert(findingRows.length > 0, `No findings created for completed run ${runId}`);

  const findingsMissingDecisionInput = findingRows.filter(
    (row) => !isNonEmptyObject(row.decision_input)
  );
  const findingsMissingDecisionResult = findingRows.filter(
    (row) => !isNonEmptyObject(row.decision_result)
  );

  assert(
    findingsMissingDecisionInput.length === 0,
    `decision_input missing/empty for findings: ${findingsMissingDecisionInput.map((f) => f.id).join(", ")}`
  );
  assert(
    findingsMissingDecisionResult.length === 0,
    `decision_result missing/empty for findings: ${findingsMissingDecisionResult.map((f) => f.id).join(", ")}`
  );

  const findingIds = findingRows.map((row) => row.id);

  const { data: policyDecisions, error: policyDecisionsError } = await supabase
    .from("policy_decisions")
    .select("id, finding_id, decision_result")
    .eq("tenant_id", tenantId)
    .in("finding_id", findingIds);

  if (policyDecisionsError) {
    throw new Error(`Failed reading policy_decisions: ${policyDecisionsError.message}`);
  }

  const decisionRows = policyDecisions ?? [];
  const uniqueDecisionFindingIds = new Set(
    decisionRows
      .map((row) => row.finding_id as string | null)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );

  assert(
    uniqueDecisionFindingIds.size > 0,
    `No policy_decisions rows found for findings in run ${runId}`
  );
  assert(
    uniqueDecisionFindingIds.size === findingIds.length,
    `Expected policy_decisions coverage for all findings (${findingIds.length}), got ${uniqueDecisionFindingIds.size}`
  );

  const { data: remediationActions, error: remediationError } = await supabase
    .from("remediation_actions")
    .select("id, finding_id, action_type, action_status, execution_status")
    .eq("tenant_id", tenantId)
    .in("finding_id", findingIds);

  if (remediationError) {
    throw new Error(`Failed reading remediation_actions: ${remediationError.message}`);
  }

  const { data: approvalRequests, error: approvalError } = await supabase
    .from("approval_requests")
    .select("id, finding_id, remediation_action_id, status")
    .eq("tenant_id", tenantId)
    .in("finding_id", findingIds);

  if (approvalError) {
    throw new Error(`Failed reading approval_requests: ${approvalError.message}`);
  }

  const monitorOnlyFindings = findingRows.filter((row) => row.decision_result?.action === "monitor_only");
  const remediationCount = remediationActions?.length ?? 0;
  const approvalCount = approvalRequests?.length ?? 0;

  assert(
    remediationCount > 0 || approvalCount > 0 || monitorOnlyFindings.length > 0,
    [
      "Expected one v4 post-decision path but found none:",
      "- no remediation_actions",
      "- no approval_requests",
      "- no monitor_only decision_result.action",
      `runId=${runId}`,
    ].join(" ")
  );

  console.log(`[qa-v4] findings created: ${findingRows.length}`);
  console.log(`[qa-v4] policy_decisions coverage: ${uniqueDecisionFindingIds.size}/${findingIds.length}`);
  console.log(`[qa-v4] remediation_actions: ${remediationCount}`);
  console.log(`[qa-v4] approval_requests: ${approvalCount}`);
  console.log(`[qa-v4] monitor_only findings: ${monitorOnlyFindings.length}`);
}

async function main() {
  const tenantId = process.env.TEST_TENANT_ID?.trim() || DEFAULT_SEEDED_TENANT_ID;
  if (!process.env.INNGEST_EVENT_KEY?.trim()) {
    process.env.INNGEST_EVENT_KEY = DEFAULT_DEV_INNGEST_EVENT_KEY;
  }
  const maxAttempts = Number(process.env.QA_MAX_ATTEMPTS ?? 20);
  const pollIntervalMs = Number(process.env.QA_POLL_INTERVAL_MS ?? 3000);

  assert(
    Number.isInteger(maxAttempts) && maxAttempts > 0,
    "QA_MAX_ATTEMPTS must be a positive integer."
  );
  assert(
    Number.isInteger(pollIntervalMs) && pollIntervalMs >= 500,
    "QA_POLL_INTERVAL_MS must be an integer >= 500."
  );

  console.log("=== SecureWatch360 v4 E2E QA ===");
  console.log(`[qa-v4] tenantId=${tenantId}`);
  if (!process.env.TEST_TENANT_ID?.trim()) {
    console.log(`[qa-v4] TEST_TENANT_ID missing; using default seeded tenant ${DEFAULT_SEEDED_TENANT_ID}`);
  }
  if (process.env.INNGEST_EVENT_KEY === DEFAULT_DEV_INNGEST_EVENT_KEY) {
    console.log("[qa-v4] INNGEST_EVENT_KEY missing; using local dev placeholder key");
  }
  console.log(`[qa-v4] maxAttempts=${maxAttempts} pollIntervalMs=${pollIntervalMs}`);

  const startedAfterIso = new Date().toISOString();
  const scanTargetId = await createQaScanTarget(tenantId);
  console.log(`[qa-v4] created scan target: ${scanTargetId}`);

  await triggerScanWorkflow(tenantId, scanTargetId);
  console.log("[qa-v4] triggered securewatch/scan.requested event");

  const run = await waitForRunCompletion(
    tenantId,
    scanTargetId,
    startedAfterIso,
    maxAttempts,
    pollIntervalMs
  );
  console.log(`[qa-v4] completed run: ${run.id}`);

  await verifyV4Artifacts(tenantId, run.id);
  console.log("[qa-v4] PASS");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[qa-v4] FAIL: ${message}`);
  process.exit(1);
});
