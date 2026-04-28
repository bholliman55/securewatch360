import { loadEnvConfig } from "@next/env";
import { inngest } from "../src/inngest/client";
import { getSupabaseAdminClient } from "../src/lib/supabase";

loadEnvConfig(process.cwd());

const DEFAULT_TENANT_ID = "8c2b980c-9fc8-4b71-9b5f-2e90a5c3a001";
const DEFAULT_TARGETS = [
  "http://testphp.vulnweb.com",
  "https://expired.badssl.com",
  "https://self-signed.badssl.com",
];

type ScanRun = {
  id: string;
  status: string;
  error_message: string | null;
};

type FindingSummary = {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseTargets(): string[] {
  const fromEnv = process.env.ADVERSARIAL_TARGETS?.trim();
  if (!fromEnv) return DEFAULT_TARGETS;
  const targets = fromEnv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return targets.length > 0 ? targets : DEFAULT_TARGETS;
}

async function createScanTarget(tenantId: string, targetValue: string): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString().replace(/[:.]/g, "-");
  const { data, error } = await supabase
    .from("scan_targets")
    .insert({
      tenant_id: tenantId,
      target_name: `adv-${new URL(targetValue).hostname}-${now}`,
      target_type: "url",
      target_value: targetValue,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed creating scan target for ${targetValue}: ${error?.message ?? "unknown error"}`);
  }
  return data.id as string;
}

async function triggerScan(tenantId: string, scanTargetId: string) {
  await inngest.send({
    name: "securewatch/scan.requested",
    data: { tenantId, scanTargetId },
  });
}

async function waitForRun(
  tenantId: string,
  scanTargetId: string,
  createdAfterIso: string,
  maxAttempts = 60,
  pollMs = 3000
): Promise<ScanRun> {
  const supabase = getSupabaseAdminClient();
  let lastStatus = "not_found";

  for (let i = 1; i <= maxAttempts; i++) {
    const { data, error } = await supabase
      .from("scan_runs")
      .select("id, status, error_message, created_at")
      .eq("tenant_id", tenantId)
      .eq("scan_target_id", scanTargetId)
      .gte("created_at", createdAfterIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed polling scan_runs: ${error.message}`);
    }

    if (data) {
      lastStatus = data.status;
      console.log(`[adv-qa] poll ${i}/${maxAttempts}: run=${data.id} status=${data.status}`);
      if (data.status === "completed") {
        return data as ScanRun;
      }
      if (data.status === "failed" || data.status === "cancelled") {
        throw new Error(`Run ${data.id} entered terminal failure status=${data.status}: ${data.error_message ?? "n/a"}`);
      }
    } else {
      console.log(`[adv-qa] poll ${i}/${maxAttempts}: run not visible yet`);
    }

    await sleep(pollMs);
  }

  throw new Error(`Timed out waiting for completion (last status: ${lastStatus})`);
}

async function summarizeFindings(tenantId: string, runId: string): Promise<FindingSummary> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("findings")
    .select("severity")
    .eq("tenant_id", tenantId)
    .eq("scan_run_id", runId);

  if (error) {
    throw new Error(`Failed reading findings for run ${runId}: ${error.message}`);
  }

  const summary: FindingSummary = {
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  for (const row of data ?? []) {
    summary.total += 1;
    const sev = String(row.severity ?? "").toLowerCase();
    if (sev in summary) {
      (summary as Record<string, number>)[sev] += 1;
    }
  }

  return summary;
}

async function main() {
  const tenantId = process.env.TEST_TENANT_ID?.trim() || DEFAULT_TENANT_ID;
  const targets = parseTargets();
  const results: Array<{
    target: string;
    scanTargetId?: string;
    runId?: string;
    status: "ok" | "error";
    findings?: FindingSummary;
    error?: string;
  }> = [];

  if (!process.env.INNGEST_EVENT_KEY?.trim()) {
    process.env.INNGEST_EVENT_KEY = "dev-local-key";
  }

  console.log("=== SecureWatch360 Adversarial URL QA ===");
  console.log(`[adv-qa] tenantId=${tenantId}`);
  console.log(`[adv-qa] targets=${targets.join(", ")}`);

  for (const target of targets) {
    try {
      const startedAfter = new Date().toISOString();
      const scanTargetId = await createScanTarget(tenantId, target);
      console.log(`[adv-qa] created target ${scanTargetId} for ${target}`);
      await triggerScan(tenantId, scanTargetId);
      console.log(`[adv-qa] triggered scan for ${target}`);
      const run = await waitForRun(tenantId, scanTargetId, startedAfter);
      const findings = await summarizeFindings(tenantId, run.id);
      console.log(`[adv-qa] completed ${target} -> run ${run.id} findings=${findings.total}`);
      results.push({ target, scanTargetId, runId: run.id, status: "ok", findings });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[adv-qa] failed ${target}: ${message}`);
      results.push({ target, status: "error", error: message });
    }
  }

  console.log("\n=== Adversarial Scan Summary ===");
  for (const row of results) {
    if (row.status === "ok" && row.findings) {
      console.log(
        `- ${row.target}\n  run=${row.runId} findings=${row.findings.total} (critical=${row.findings.critical}, high=${row.findings.high}, medium=${row.findings.medium}, low=${row.findings.low}, info=${row.findings.info})`
      );
    } else {
      console.log(`- ${row.target}\n  error=${row.error}`);
    }
  }

  const failed = results.filter((r) => r.status === "error").length;
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[adv-qa] FAIL: ${message}`);
  process.exit(1);
});

