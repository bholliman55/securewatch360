import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const repoRoot = process.cwd();
const resultsDir = path.join(repoRoot, ".simulation-results");
const reportDir = path.join(repoRoot, "docs", "reports");

const DEMO_SCENARIOS = [
  "golden-vulnerable-dependency-ticket",
  "golden-ransomware-isolated-incident-report",
  "golden-cmmc-drift-corrected",
];

function parseArgs(argv) {
  const args = new Set(argv);
  return {
    dryRun: args.has("--dry-run"),
  };
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function getEnvErrors() {
  const mode = (process.env.SIMULATION_MODE || "").trim().toLowerCase();
  const errors = [];
  if (!mode || (mode !== "supabase" && mode !== "inngest")) {
    errors.push("SIMULATION_MODE must be set to 'supabase' or 'inngest'.");
  }

  const demoMode = (process.env.SIMULATION_DEMO_MODE || "").trim().toLowerCase();
  if (demoMode === "1" || demoMode === "true" || demoMode === "yes") {
    errors.push("SIMULATION_DEMO_MODE must be disabled for staging rehearsal.");
  }

  if (!process.env.SIMULATION_TENANT_ID?.trim()) {
    errors.push("SIMULATION_TENANT_ID is required.");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    errors.push("SUPABASE_SERVICE_ROLE_KEY is required.");
  }
  if (!process.env.SUPABASE_URL?.trim() && !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    errors.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required.");
  }
  if (mode === "inngest" && !process.env.INNGEST_EVENT_KEY?.trim()) {
    errors.push("INNGEST_EVENT_KEY is required when SIMULATION_MODE=inngest.");
  }

  return errors;
}

function runCommand(command, args, options = {}) {
  const allowedExitCodes = options.allowedExitCodes || [0];
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const exitCode = Number(code ?? 0);
      if (allowedExitCodes.includes(exitCode)) {
        resolve({ stdout, stderr, code: exitCode });
      } else {
        reject(new Error(`Command failed (${exitCode}): ${command} ${args.join(" ")}`));
      }
    });
  });
}

async function listRunIds() {
  try {
    const entries = await fs.readdir(resultsDir);
    return new Set(
      entries
        .filter((name) => name.endsWith("-simulation-result.json"))
        .map((name) => name.replace("-simulation-result.json", ""))
    );
  } catch {
    return new Set();
  }
}

async function newestRunId(beforeSet) {
  const afterSet = await listRunIds();
  const newIds = [...afterSet].filter((id) => !beforeSet.has(id));
  if (newIds.length === 0) return null;

  const withTimes = await Promise.all(
    newIds.map(async (id) => {
      const stat = await fs.stat(path.join(resultsDir, `${id}-simulation-result.json`));
      return { id, mtime: stat.mtimeMs };
    })
  );
  withTimes.sort((a, b) => b.mtime - a.mtime);
  return withTimes[0]?.id ?? null;
}

async function readValidationSummary(runId) {
  const file = path.join(resultsDir, `${runId}-simulation-result.json`);
  const payload = JSON.parse(await fs.readFile(file, "utf8"));
  const result = payload.result || {};
  const rows = Array.isArray(result.validationResults) ? result.validationResults : [];
  const passedCount = rows.filter((r) => r.passed === true).length;
  return {
    passed: result.passed === true,
    passedCount,
    totalCount: rows.length,
  };
}

async function writeReport(entries) {
  await fs.mkdir(reportDir, { recursive: true });
  const ts = nowStamp();
  const latestPath = path.join(reportDir, "demo-stack-staging-latest.md");
  const stampedPath = path.join(reportDir, `demo-stack-staging-${ts}.md`);
  const lines = [
    "# Demo Stack Staging Rehearsal",
    "",
    `- timestamp: ${new Date().toISOString()}`,
    `- simulation_mode: ${process.env.SIMULATION_MODE || "(unset)"}`,
    `- tenant_id: ${process.env.SIMULATION_TENANT_ID || "(unset)"}`,
    "",
    "## Scenario Results",
    "",
    "| Scenario | Status | Run ID | Validations |",
    "|---|---|---|---|",
  ];

  for (const entry of entries) {
    const status = entry.passed ? "PASS" : "FAIL";
    lines.push(
      `| ${entry.scenario} | ${status} | \`${entry.runId}\` | ${entry.passedCount}/${entry.totalCount} |`
    );
  }

  lines.push("");
  lines.push(`Artifacts directory: \`${resultsDir}\``);
  lines.push(`Human reports directory: \`${path.join(repoRoot, "simulator", "reports", "output")}\``);
  lines.push("");

  const body = lines.join("\n");
  await fs.writeFile(latestPath, body, "utf8");
  await fs.writeFile(stampedPath, body, "utf8");
  return { latestPath, stampedPath };
}

async function runScenario(scenario) {
  console.log(`\n=== Staging scenario: ${scenario} ===`);
  const beforeSet = await listRunIds();
  await runCommand("npm", ["run", "sim:run", "--", "--scenario", scenario], {
    allowedExitCodes: [0, 1],
  });
  const runId = await newestRunId(beforeSet);
  if (!runId) {
    throw new Error(`Could not determine runId for scenario ${scenario}`);
  }
  await runCommand("npm", ["run", "sim:report", "--", "--runId", runId]);
  const summary = await readValidationSummary(runId);
  return { scenario, runId, ...summary };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envErrors = getEnvErrors();
  if (envErrors.length > 0) {
    for (const err of envErrors) {
      console.error(`- ${err}`);
    }
    process.exitCode = 2;
    return;
  }

  console.log("SecureWatch360 staging demo stack rehearsal");
  console.log(`SIMULATION_MODE=${process.env.SIMULATION_MODE}`);
  console.log(`SIMULATION_TENANT_ID=${process.env.SIMULATION_TENANT_ID}`);
  if (args.dryRun) {
    console.log("Dry-run complete: environment preflight passed.");
    return;
  }

  const entries = [];
  for (const scenario of DEMO_SCENARIOS) {
    entries.push(await runScenario(scenario));
  }
  const report = await writeReport(entries);

  console.log("\n=== Staging summary ===");
  for (const entry of entries) {
    const status = entry.passed ? "PASS" : "FAIL";
    console.log(`- ${entry.scenario}: ${status} runId=${entry.runId} (${entry.passedCount}/${entry.totalCount})`);
  }
  console.log(`Latest report: ${report.latestPath}`);
  console.log(`Stamped report: ${report.stampedPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
