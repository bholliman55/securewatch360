import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { inngest } from "../src/inngest/client";
import { getSupabaseAdminClient } from "../src/lib/supabase";
import type { InngestEventMap } from "../src/types";

loadEnvConfig(process.cwd());

const DEFAULT_TENANT_ID = "8c2b980c-9fc8-4b71-9b5f-2e90a5c3a001";
const DEFAULT_ITERATIONS = 12;
const DEFAULT_POLL_ATTEMPTS = 40;
const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_CREATION_ATTEMPTS = 30;
const DEFAULT_CREATION_INTERVAL_MS = 1000;
const DEFAULT_STALE_MINUTES = 10;

type ChaosStepResult = {
  iteration: number;
  action: "scan.requested" | "monitoring.alert.received";
  ok: boolean;
  details: string[];
  error?: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

async function createChaosScanTarget(tenantId: string, targetValue: string): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const targetType = targetValue.startsWith("http") ? "url" : targetValue.includes("/") ? "cidr" : "hostname";
  const { data, error } = await supabase
    .from("scan_targets")
    .insert({
      tenant_id: tenantId,
      target_name: `chaos-target-${Date.now()}`,
      target_type: targetType,
      target_value: targetValue,
      status: "active",
      created_at: now,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Failed creating chaos scan target: ${error?.message ?? "unknown error"}`);
  }
  return data.id as string;
}

async function waitForScanCompletion(scanRunId: string, attempts: number, intervalMs: number): Promise<string> {
  const supabase = getSupabaseAdminClient();
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await supabase
      .from("scan_runs")
      .select("status")
      .eq("id", scanRunId)
      .single();
    if (error || !data) {
      throw new Error(`Could not read scan run ${scanRunId}: ${error?.message ?? "not found"}`);
    }
    if (data.status === "completed" || data.status === "failed" || data.status === "cancelled") {
      return data.status as string;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return "running";
}

async function latestScanRunIdForTarget(
  tenantId: string,
  scanTargetId: string,
  createdAfterIso: string
): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("scan_runs")
    .select("id, created_at")
    .eq("tenant_id", tenantId)
    .eq("scan_target_id", scanTargetId)
    .gte("created_at", createdAfterIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed fetching latest scan run: ${error.message}`);
  return (data?.id as string | undefined) ?? null;
}

async function countStaleRunningRuns(tenantId: string, staleMinutes: number): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const cutoff = new Date(Date.now() - staleMinutes * 60_000).toISOString();
  const { data, error } = await supabase
    .from("scan_runs")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "running")
    .lt("created_at", cutoff);
  if (error) throw new Error(`Failed querying stale runs: ${error.message}`);
  return (data ?? []).length;
}

function renderMarkdown(args: {
  runId: string;
  tenantId: string;
  iterations: number;
  results: ChaosStepResult[];
  staleRunningCount: number;
}): string {
  const passed = args.results.filter((r) => r.ok).length;
  const failed = args.results.length - passed;
  const lines: string[] = [];
  lines.push("# SecureWatch360 Chaos Report");
  lines.push("");
  lines.push(`- runId: \`${args.runId}\``);
  lines.push(`- tenantId: \`${args.tenantId}\``);
  lines.push(`- iterations: \`${args.iterations}\``);
  lines.push(`- passed: \`${passed}\``);
  lines.push(`- failed: \`${failed}\``);
  lines.push(`- staleRunningCount: \`${args.staleRunningCount}\``);
  lines.push("");
  lines.push("## Iteration Results");
  lines.push("");
  for (const row of args.results) {
    lines.push(`### Iteration ${row.iteration} (${row.action})`);
    lines.push(`- ok: \`${row.ok}\``);
    for (const detail of row.details) lines.push(`- detail: ${detail}`);
    if (row.error) lines.push(`- error: ${row.error}`);
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  const tenantId = process.env.TEST_TENANT_ID?.trim() || DEFAULT_TENANT_ID;
  const iterations = Number(process.env.CHAOS_ITERATIONS ?? DEFAULT_ITERATIONS);
  const pollAttempts = Number(process.env.CHAOS_POLL_ATTEMPTS ?? DEFAULT_POLL_ATTEMPTS);
  const pollIntervalMs = Number(process.env.CHAOS_POLL_INTERVAL_MS ?? DEFAULT_POLL_INTERVAL_MS);
  const creationAttempts = Number(process.env.CHAOS_CREATION_ATTEMPTS ?? DEFAULT_CREATION_ATTEMPTS);
  const creationIntervalMs = Number(
    process.env.CHAOS_CREATION_INTERVAL_MS ?? DEFAULT_CREATION_INTERVAL_MS
  );
  const staleMinutes = Number(process.env.CHAOS_STALE_MINUTES ?? DEFAULT_STALE_MINUTES);
  const targetCandidates = (process.env.CHAOS_TARGETS ?? process.env.QA_TARGET_URL ?? "https://example.com")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  assert(process.env.NEXT_PUBLIC_SUPABASE_URL, "Missing NEXT_PUBLIC_SUPABASE_URL");
  assert(process.env.SUPABASE_SERVICE_ROLE_KEY, "Missing SUPABASE_SERVICE_ROLE_KEY");
  assert(Number.isInteger(iterations) && iterations > 0, "CHAOS_ITERATIONS must be a positive integer");
  assert(targetCandidates.length > 0, "At least one CHAOS_TARGETS value is required");

  const scanTargetId = await createChaosScanTarget(tenantId, randomItem(targetCandidates));
  const results: ChaosStepResult[] = [];
  const runId = `qa-v4-chaos-${new Date().toISOString().replace(/[:.]/g, "-")}`;

  for (let i = 1; i <= iterations; i++) {
    const action =
      Math.random() > 0.35
        ? ("scan.requested" as const)
        : ("monitoring.alert.received" as const);
    try {
      if (action === "scan.requested") {
        const triggerAt = new Date().toISOString();
        await inngest.send({
          name: "securewatch/scan.requested",
          data: { tenantId, scanTargetId } satisfies InngestEventMap["securewatch/scan.requested"],
        });
        let scanRunId: string | null = null;
        for (let attempt = 0; attempt < creationAttempts; attempt++) {
          scanRunId = await latestScanRunIdForTarget(tenantId, scanTargetId, triggerAt);
          if (scanRunId) break;
          await new Promise((resolve) => setTimeout(resolve, creationIntervalMs));
        }
        if (!scanRunId) throw new Error("No scan run created");
        const status = await waitForScanCompletion(scanRunId, pollAttempts, pollIntervalMs);
        const ok = status === "completed";
        results.push({
          iteration: i,
          action,
          ok,
          details: [`scanRunId=${scanRunId}`, `status=${status}`],
          error: ok ? undefined : `Scan ended in status ${status}`,
        });
      } else {
        await inngest.send({
          name: "securewatch/monitoring.alert.received",
          data: {
            tenantId,
            source: "chaos-test",
            alertType: randomItem(["anomaly", "endpoint-alert", "network-alert"]),
            severity: randomItem(["medium", "high", "critical"]),
            title: `Chaos monitoring alert ${i}`,
            description: "Generated by qa-v4-chaos",
            createFinding: true,
          } satisfies InngestEventMap["securewatch/monitoring.alert.received"],
        });
        results.push({
          iteration: i,
          action,
          ok: true,
          details: ["monitoring alert queued"],
        });
      }
    } catch (error) {
      results.push({
        iteration: i,
        action,
        ok: false,
        details: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const staleRunningCount = await countStaleRunningRuns(tenantId, staleMinutes);
  const reportDir = join(process.cwd(), "docs", "reports");
  mkdirSync(reportDir, { recursive: true });
  const markdown = renderMarkdown({
    runId,
    tenantId,
    iterations,
    results,
    staleRunningCount,
  });
  const mdPath = join(reportDir, `chaos-${runId}.md`);
  const mdLatestPath = join(reportDir, "chaos-latest.md");
  const jsonPath = join(reportDir, `chaos-${runId}.json`);
  const jsonLatestPath = join(reportDir, "chaos-latest.json");
  writeFileSync(mdPath, markdown, "utf8");
  writeFileSync(mdLatestPath, markdown, "utf8");
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        runId,
        tenantId,
        iterations,
        staleRunningCount,
        results,
      },
      null,
      2
    ),
    "utf8"
  );
  writeFileSync(
    jsonLatestPath,
    JSON.stringify(
      {
        runId,
        tenantId,
        iterations,
        staleRunningCount,
        results,
      },
      null,
      2
    ),
    "utf8"
  );

  const failed = results.filter((r) => !r.ok).length;
  if (failed > 0 || staleRunningCount > 0) {
    throw new Error(
      `Chaos run has failures (failed=${failed}, staleRunningCount=${staleRunningCount}). See ${mdPath}`
    );
  }

  console.log(`[qa-v4-chaos] PASS - report written to ${mdPath.replace(process.cwd(), ".")}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[qa-v4-chaos] FAIL: ${message}`);
  process.exit(1);
});
