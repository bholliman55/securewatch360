/**
 * CLI: npm run sim:chaos
 * Runs the simulator chaos lab — synthetic fault injection, metrics, resilience score.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { parseCliArgs, defaultSimulationResultsDir } from "./shared";
import { runChaosLab } from "../chaos/runChaosLab";

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function main() {
  const cwd = process.cwd();
  const args = parseCliArgs(process.argv.slice(2));

  const ticks = parsePositiveInt(typeof args.ticks === "string" ? args.ticks : undefined, 12);
  const seed =
    typeof args.seed === "string" && args.seed.trim()
      ? Number.parseInt(args.seed, 10)
      : undefined;
  const shuffle = args.shuffle === true;

  const outDirRaw =
    (typeof args.outDir === "string" && args.outDir.trim()) ||
    (typeof args.out === "string" && args.out.trim()) ||
    "";
  const outDir = outDirRaw ? path.resolve(cwd, outDirRaw) : defaultSimulationResultsDir(cwd);

  const skipDelayEnv =
    args["skip-delay"] === true ||
    (typeof process.env.CHAOS_LAB_SKIP_DELAY === "string" &&
      ["1", "true", "yes"].includes(process.env.CHAOS_LAB_SKIP_DELAY.toLowerCase()));

  if (skipDelayEnv) {
    process.env.CHAOS_LAB_SKIP_DELAY = "true";
  }

  const report = await runChaosLab({
    ticks,
    ...(seed !== undefined && Number.isFinite(seed) ? { seed } : {}),
    shuffle,
  });

  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${report.lab_run_id}-chaos-lab-report.json`);
  await fs.writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Chaos lab run ${report.lab_run_id}`);
  console.log(`Resilience score: ${report.resilience.score}/100`);
  console.log(`Ticks: ${report.ticks.length} | Report: ${outPath}`);
  if (report.resilience.deductions.length > 0) {
    console.log("Deductions:", report.resilience.deductions.map((d) => `${d.reason} (-${d.points})`).join("; "));
  }
  if (report.resilience.bonuses.length > 0) {
    console.log("Bonuses:", report.resilience.bonuses.map((b) => `${b.reason} (+${b.points})`).join("; "));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
