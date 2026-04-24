import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { getSupabaseAdminClient } from "../src/lib/supabase";

loadEnvConfig(process.cwd());

const DEFAULT_SEEDED_TENANT_ID = "8c2b980c-9fc8-4b71-9b5f-2e90a5c3a001";
const LATEST_AGENT_REPORT_JSON = join(process.cwd(), "docs", "reports", "agent-e2e-latest.json");

type AgentTestRow = {
  id: string;
  title: string;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  details: string[];
  error?: string;
};

type AgentRunReport = {
  runId: string;
  context?: {
    tenantId?: string;
  };
  results: AgentTestRow[];
};

type Scenario = {
  id: string;
  title: string;
  description: string;
  env: Record<string, string>;
  enabled: boolean;
  skipReason?: string;
};

type IterationResult = {
  scenarioId: string;
  iteration: number;
  passed: boolean;
  failedTests: string[];
  skippedTests: string[];
  reportRunId?: string;
  durationMs: number;
  staleRunningCount: number;
  error?: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readAgentLatestReport(): AgentRunReport {
  const raw = readFileSync(LATEST_AGENT_REPORT_JSON, "utf8");
  return JSON.parse(raw) as AgentRunReport;
}

async function countPotentiallyStaleRunningRuns(tenantId: string, minutes: number): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const cutoff = new Date(Date.now() - minutes * 60_000).toISOString();
  const { data, error } = await supabase
    .from("scan_runs")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "running")
    .lt("created_at", cutoff);

  if (error) {
    throw new Error(`Failed querying stale running scan runs: ${error.message}`);
  }
  return (data ?? []).length;
}

function buildScenarios(): Scenario[] {
  const hasOpaUrl = Boolean(process.env.OPA_POLICY_EVAL_URL?.trim());
  return [
    {
      id: "rules-baseline",
      title: "Rules Provider Baseline",
      description: "Verifies stable operation with deterministic rules provider.",
      env: {
        DECISION_ENGINE_PROVIDER: "rules",
      },
      enabled: true,
    },
    {
      id: "opa-failopen",
      title: "OPA Provider Fail-Open",
      description:
        "Forces OPA provider with an unreachable endpoint and validates fail-open fallback to rules.",
      env: {
        DECISION_ENGINE_PROVIDER: "opa",
        OPA_POLICY_EVAL_URL: "http://127.0.0.1:65535/decision",
        OPA_POLICY_EVAL_TIMEOUT_MS: "750",
      },
      enabled: true,
    },
    {
      id: "opa-configured-endpoint",
      title: "OPA Provider Configured Endpoint",
      description: "Uses configured OPA endpoint if provided in environment.",
      env: {
        DECISION_ENGINE_PROVIDER: "opa",
      },
      enabled: hasOpaUrl,
      skipReason: hasOpaUrl ? undefined : "OPA_POLICY_EVAL_URL not configured in environment",
    },
  ];
}

function runAgentSuiteWithEnv(extraEnv: Record<string, string>): { output: string; durationMs: number } {
  const start = Date.now();
  const output = execSync("npm run qa:v4:agents", {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...extraEnv,
    },
    encoding: "utf8",
    stdio: "pipe",
  });
  return { output, durationMs: Date.now() - start };
}

function renderMarkdown(args: {
  runId: string;
  tenantId: string;
  iterations: number;
  staleThresholdMinutes: number;
  results: IterationResult[];
  scenarios: Scenario[];
}): string {
  const { runId, tenantId, iterations, staleThresholdMinutes, results, scenarios } = args;
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  const lines: string[] = [];
  lines.push("# SecureWatch360 Hardening Report");
  lines.push("");
  lines.push(`- runId: \`${runId}\``);
  lines.push(`- tenantId: \`${tenantId}\``);
  lines.push(`- iterationsPerScenario: \`${iterations}\``);
  lines.push(`- staleRunningThresholdMinutes: \`${staleThresholdMinutes}\``);
  lines.push(`- summary: passed=${passed}, failed=${failed}, total=${total}`);
  lines.push("");
  lines.push("## Scenario Matrix");
  lines.push("");
  for (const scenario of scenarios) {
    lines.push(`### ${scenario.id} - ${scenario.title}`);
    lines.push(`- enabled: \`${scenario.enabled}\``);
    lines.push(`- description: ${scenario.description}`);
    if (!scenario.enabled && scenario.skipReason) {
      lines.push(`- skipReason: ${scenario.skipReason}`);
    }
    lines.push("");
  }

  lines.push("## Iteration Results");
  lines.push("");
  for (const row of results) {
    lines.push(`### ${row.scenarioId} / iteration ${row.iteration}`);
    lines.push(`- passed: \`${row.passed}\``);
    lines.push(`- durationMs: \`${row.durationMs}\``);
    lines.push(`- staleRunningCount: \`${row.staleRunningCount}\``);
    if (row.reportRunId) lines.push(`- agentReportRunId: \`${row.reportRunId}\``);
    if (row.failedTests.length > 0) lines.push(`- failedTests: ${row.failedTests.join(", ")}`);
    if (row.skippedTests.length > 0) lines.push(`- skippedTests: ${row.skippedTests.join(", ")}`);
    if (row.error) lines.push(`- error: ${row.error}`);
    lines.push("");
  }

  lines.push("## Notes");
  lines.push("");
  lines.push("- This hardening run executes the full agent E2E suite repeatedly under provider matrix scenarios.");
  lines.push("- `opa-failopen` validates bootstrap safety: OPA outage should not break decisioning pipeline.");
  lines.push("- Stale running scans metric detects workflow hangs older than threshold.");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const tenantId = process.env.TEST_TENANT_ID?.trim() || DEFAULT_SEEDED_TENANT_ID;
  const iterations = Number(process.env.HARDENING_ITERATIONS ?? 3);
  const staleThresholdMinutes = Number(process.env.HARDENING_STALE_RUN_MINUTES ?? 10);

  assert(process.env.NEXT_PUBLIC_SUPABASE_URL, "Missing NEXT_PUBLIC_SUPABASE_URL");
  assert(process.env.SUPABASE_SERVICE_ROLE_KEY, "Missing SUPABASE_SERVICE_ROLE_KEY");
  assert(Number.isInteger(iterations) && iterations > 0, "HARDENING_ITERATIONS must be a positive integer");
  assert(
    Number.isInteger(staleThresholdMinutes) && staleThresholdMinutes > 0,
    "HARDENING_STALE_RUN_MINUTES must be a positive integer"
  );

  const scenarios = buildScenarios();
  const runId = `qa-v4-hardening-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const results: IterationResult[] = [];

  for (const scenario of scenarios) {
    if (!scenario.enabled) {
      continue;
    }

    for (let i = 1; i <= iterations; i++) {
      const started = Date.now();
      try {
        runAgentSuiteWithEnv(scenario.env);
        const report = readAgentLatestReport();
        const failedTests = report.results
          .filter((row) => row.status === "failed")
          .map((row) => `${row.id}:${row.title}`);
        const skippedTests = report.results
          .filter((row) => row.status === "skipped")
          .map((row) => `${row.id}:${row.title}`);
        const staleRunningCount = await countPotentiallyStaleRunningRuns(tenantId, staleThresholdMinutes);

        results.push({
          scenarioId: scenario.id,
          iteration: i,
          passed: failedTests.length === 0 && staleRunningCount === 0,
          failedTests,
          skippedTests,
          reportRunId: report.runId,
          staleRunningCount,
          durationMs: Date.now() - started,
        });
      } catch (error) {
        const staleRunningCount = await countPotentiallyStaleRunningRuns(tenantId, staleThresholdMinutes).catch(
          () => -1
        );
        results.push({
          scenarioId: scenario.id,
          iteration: i,
          passed: false,
          failedTests: [],
          skippedTests: [],
          durationMs: Date.now() - started,
          staleRunningCount,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const reportDir = join(process.cwd(), "docs", "reports");
  mkdirSync(reportDir, { recursive: true });
  const md = renderMarkdown({
    runId,
    tenantId,
    iterations,
    staleThresholdMinutes,
    results,
    scenarios,
  });
  const mdPath = join(reportDir, `hardening-${runId}.md`);
  const latestPath = join(reportDir, "hardening-latest.md");
  const jsonPath = join(reportDir, `hardening-${runId}.json`);
  const latestJsonPath = join(reportDir, "hardening-latest.json");
  writeFileSync(mdPath, md, "utf8");
  writeFileSync(latestPath, md, "utf8");
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        runId,
        tenantId,
        iterations,
        staleThresholdMinutes,
        scenarios,
        results,
      },
      null,
      2
    ),
    "utf8"
  );
  writeFileSync(
    latestJsonPath,
    JSON.stringify(
      {
        runId,
        tenantId,
        iterations,
        staleThresholdMinutes,
        scenarios,
        results,
      },
      null,
      2
    ),
    "utf8"
  );

  const failures = results.filter((row) => !row.passed);
  if (failures.length > 0) {
    throw new Error(
      `Hardening matrix has ${failures.length} failing iterations. See ${mdPath.replace(process.cwd(), ".")}`
    );
  }

  console.log(`[qa-v4-hardening] PASS - report written to ${mdPath.replace(process.cwd(), ".")}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[qa-v4-hardening] FAIL: ${message}`);
  process.exit(1);
});
