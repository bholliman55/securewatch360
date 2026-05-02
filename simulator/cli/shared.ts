/**
 * Shared helpers for SecureWatch360 simulator CLI (tsx entrypoints).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { parseSimulationScenarioDocument, type ScenarioDefinition } from "../schema";
import type { SimulationResult, SimulationRun } from "../types";
import type { CollectedSignals } from "../engineSignals.types";
import type { EmitCorrelation } from "../engines/eventEmitter";
import type { AutonomyScorecard } from "../reports/autonomyScorecard";
import type { AgentValidatorResult } from "../validators/agentValidatorShared";

/** Skip argv[0]=node and argv[1]=script — pass `process.argv.slice(2)` from CLI runners. */
export function parseCliArgs(argv: readonly string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    const hasVal = Boolean(next && !next.startsWith("--"));
    if (hasVal) {
      out[key] = next!;
      i += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

export function defaultScenariosDir(cwd: string = process.cwd()): string {
  return path.join(cwd, "simulator", "scenarios");
}

/**
 * Scenario directory for simulator CLIs (`sim:list` continues to default; use env for tooling/tests).
 * `SIMULATION_SCENARIOS_DIR` — absolute or relative to cwd.
 */
export function cliScenariosDir(cwd: string = process.cwd()): string {
  const raw = process.env.SIMULATION_SCENARIOS_DIR?.trim();
  if (!raw) return defaultScenariosDir(cwd);
  return path.isAbsolute(raw) ? raw : path.join(cwd, raw);
}

export function defaultSimulationResultsDir(cwd: string = process.cwd()): string {
  const fromEnv = process.env.SIMULATION_RESULTS_DIR?.trim();
  if (fromEnv) return path.isAbsolute(fromEnv) ? fromEnv : path.join(cwd, fromEnv);
  return path.join(cwd, ".simulation-results");
}

export interface ListedScenarioRow {
  file: string;
  stem: string;
  definition: ScenarioDefinition;
}

/** List validated scenario JSON fixtures (sorted by stem). */
export async function loadScenarioListing(scenariosDir: string): Promise<ListedScenarioRow[]> {
  const entries = await fs.readdir(scenariosDir, { withFileTypes: true });
  const out: ListedScenarioRow[] = [];
  for (const dent of entries) {
    if (!dent.isFile() || !dent.name.endsWith(".json")) continue;
    if (dent.name.startsWith(".")) continue;
    const full = path.join(scenariosDir, dent.name);
    try {
      const raw = JSON.parse(await fs.readFile(full, "utf8"));
      const definition = parseSimulationScenarioDocument(raw);
      out.push({ file: dent.name, stem: dent.name.replace(/\.json$/i, ""), definition });
    } catch {
      /* skip malformed */
    }
  }
  out.sort((a, b) => a.stem.localeCompare(b.stem));
  return out;
}

/**
 * Resolve `--scenario` value: YAML-free filename stem (`foo` → foo.json),
 * basename, full path, or internal scenario `id` substring match (first hit).
 */
export async function resolveScenarioFromSpecifier(
  spec: string,
  scenariosDir = defaultScenariosDir(),
): Promise<{ filePath: string; stem: string; definition: ScenarioDefinition } | undefined> {
  const trimmed = spec.trim();
  if (!trimmed) return undefined;

  const asPathCandidate = trimmed.endsWith(".json") || trimmed.includes("/") || trimmed.includes("\\")
    ? path.resolve(trimmed)
    : path.join(scenariosDir, `${trimmed}.json`);

  try {
    const raw = JSON.parse(await fs.readFile(asPathCandidate, "utf8"));
    const definition = parseSimulationScenarioDocument(raw);
    return {
      filePath: asPathCandidate,
      stem: path.basename(asPathCandidate, ".json"),
      definition,
    };
  } catch {
    // fall through
  }

  const listing = await loadScenarioListing(scenariosDir);
  const byStem = listing.find((r) => r.stem === trimmed);
  if (byStem)
    return { filePath: path.join(scenariosDir, byStem.file), stem: byStem.stem, definition: byStem.definition };

  const byId = listing.find((r) => r.definition.id === trimmed);
  if (byId)
    return { filePath: path.join(scenariosDir, byId.file), stem: byId.stem, definition: byId.definition };

  const fuzzy = listing.find((r) => r.definition.id.includes(trimmed) || r.stem.includes(trimmed));
  return fuzzy
    ? { filePath: path.join(scenariosDir, fuzzy.file), stem: fuzzy.stem, definition: fuzzy.definition }
    : undefined;
}

/** Look up parsed scenario fixture by canonical `scenario.id`. */
export async function findScenarioDefinitionById(
  scenarioId: string,
  scenariosDir = defaultScenariosDir(),
): Promise<ScenarioDefinition | undefined> {
  const rows = await loadScenarioListing(scenariosDir);
  return rows.find((r) => r.definition.id === scenarioId)?.definition;
}

export interface PersistedSimulationBundle {
  run: SimulationRun;
  result: SimulationResult;
  structuredReport: Record<string, unknown>;
}

/** Load `{runId}-simulation-result.json` plus sibling structured report artifact. */
export async function loadPersistedSimulationBundle(
  runId: string,
  resultsDir = defaultSimulationResultsDir(),
): Promise<PersistedSimulationBundle | undefined> {
  const trimmed = runId.trim();
  if (!trimmed) return undefined;

  const resultPath = path.join(resultsDir, `${trimmed}-simulation-result.json`);
  let resultRawText: string;
  try {
    resultRawText = await fs.readFile(resultPath, "utf8");
  } catch {
    return undefined;
  }

  let resultPayload: unknown;
  try {
    resultPayload = JSON.parse(resultRawText);
  } catch {
    throw new Error(`Invalid JSON at ${resultPath}`);
  }

  const run = (resultPayload as { run?: SimulationRun }).run;
  const result = (resultPayload as { result?: SimulationResult }).result;
  if (!run || !result || typeof run.id !== "string") {
    throw new Error(`${resultPath} missing run.result envelope`);
  }

  const reportPath = path.join(resultsDir, `${trimmed}-simulation-report.json`);
  let structuredReport: Record<string, unknown>;
  try {
    structuredReport = JSON.parse(await fs.readFile(reportPath, "utf8")) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Missing or invalid structured report ${reportPath}. Run a simulation first, or pass the matching runId.`,
    );
  }

  return { run, result, structuredReport };
}

/** Rehydrate autonomy + agents + telemetry stubs for report regeneration. */
export function hydrateReportInputs(structuredReport: Record<string, unknown>): {
  autonomyScorecard: AutonomyScorecard;
  securewatchAgents: AgentValidatorResult[];
  signals: CollectedSignals;
  emissions: EmitCorrelation[];
} {
  const autonomy = structuredReport.autonomy_scorecard as AutonomyScorecard | undefined;
  if (
    !autonomy ||
    typeof autonomy.overall_autonomy_score !== "number" ||
    typeof autonomy.detection_success_rate !== "number"
  ) {
    throw new Error("Structured report is missing autonomy_scorecard (cannot regenerate human report).");
  }

  const agents = structuredReport.securewatch_agents;
  if (!Array.isArray(agents)) {
    throw new Error("Structured report is missing securewatch_agents array.");
  }

  const tel = structuredReport.telemetry as Record<string, unknown> | undefined;
  const obs = (tel?.observation as Record<string, unknown>) ?? {};
  const win = (obs.window as Record<string, unknown>) ?? {};

  const signals: CollectedSignals = {
    observationWindowStartIso: String(win.start ?? new Date().toISOString()),
    observationWindowEndIso: String(win.end ?? new Date().toISOString()),
    pollIterations: Number(obs.polls ?? 0) || 0,
    auditRowsForRun: [],
    auditRowsNearTimeline: [],
  };

  const rawEmissions = Array.isArray(tel?.emissions) ? tel!.emissions! : [];
  const emissions: EmitCorrelation[] = rawEmissions.map((e: unknown) => {
    const o = typeof e === "object" && e !== null ? (e as Record<string, unknown>) : {};
    return {
      mode: (o.mode as EmitCorrelation["mode"]) ?? "local",
      ...(o.auditLogId !== undefined ? { auditLogId: String(o.auditLogId) } : {}),
      ...(o.ingest !== undefined ? { ingest: o.ingest } : {}),
    };
  });

  return {
    autonomyScorecard: autonomy,
    securewatchAgents: agents as AgentValidatorResult[],
    signals,
    emissions,
  };
}
