import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const repoRoot = process.cwd();
const resultsDir = path.join(repoRoot, ".simulation-results");

const DEMO_SCENARIOS = [
  "golden-vulnerable-dependency-ticket",
  "golden-ransomware-isolated-incident-report",
  "golden-cmmc-drift-corrected",
];

function runCommand(command, args, options = {}) {
  const allowedExitCodes = options.allowedExitCodes || [0];
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
      env: {
        ...process.env,
        SIMULATION_MODE: process.env.SIMULATION_MODE || "local",
        SIMULATION_DEMO_MODE: process.env.SIMULATION_DEMO_MODE || "true",
      },
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
  if (newIds.length === 0) {
    return null;
  }

  const withTimes = await Promise.all(
    newIds.map(async (id) => {
      const stat = await fs.stat(path.join(resultsDir, `${id}-simulation-result.json`));
      return { id, mtime: stat.mtimeMs };
    })
  );

  withTimes.sort((a, b) => b.mtime - a.mtime);
  return withTimes[0]?.id ?? null;
}

async function runScenarioAndReport(scenarioId) {
  console.log(`\n=== Scenario: ${scenarioId} ===`);
  const beforeSet = await listRunIds();
  const runResult = await runCommand("npm", ["run", "sim:run", "--", "--scenario", scenarioId], {
    allowedExitCodes: [0, 1],
  });
  const runId = await newestRunId(beforeSet);
  if (!runId) {
    throw new Error(`Could not detect runId artifact for scenario ${scenarioId}`);
  }
  await runCommand("npm", ["run", "sim:report", "--", "--runId", runId]);
  return { runId, passed: runResult.code === 0 };
}

async function main() {
  console.log("SecureWatch360 fastest demo stack runner");
  console.log(`SIMULATION_MODE=${process.env.SIMULATION_MODE || "local"}`);
  console.log(`SIMULATION_DEMO_MODE=${process.env.SIMULATION_DEMO_MODE || "true"}`);

  const runs = [];
  for (const scenario of DEMO_SCENARIOS) {
    const result = await runScenarioAndReport(scenario);
    runs.push({ scenario, ...result });
  }

  console.log("\n=== Demo summary ===");
  for (const row of runs) {
    const status = row.passed ? "PASS" : "FAIL";
    console.log(`- ${row.scenario}: ${status} runId=${row.runId}`);
  }
  console.log(`Artifacts: ${resultsDir}`);
  console.log(`Human reports: ${path.join(repoRoot, "simulator", "reports", "output")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
