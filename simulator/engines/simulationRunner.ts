/**
 * Loads scenario JSON fixtures, validates via Zod, emits synthetic telemetry, observes responses, persists reports.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { parseSimulationScenarioDocument, type ScenarioDefinition } from "../schema";
import { computeAutonomyScorecard } from "../reports/autonomyScorecard";
import { writeSimulationRunReports } from "../reports/reportGenerator";
import type { SimulationLabReport } from "../reports/report-types";
import type { Scenario, SimulatedEvent, SimulationRun } from "../types";
import {
  emitSimulatedEvents,
  resolveSimulationMode,
  type EmitCorrelation,
  type SimulationMode,
} from "./eventEmitter";
import type { CollectedSignals } from "../engineSignals.types";
import {
  observeAgentSignals,
  evaluateScenarioExpectations,
  persistSimulationArtifacts,
} from "./resultCollector";
import {
  applyDuplicateEventInjection,
  failureInjectionTelemetry,
  injectAgentValidatorFailures,
  isReportGenerationFailureInjected,
  mergeFailureInjectionIntoSimulationResult,
  observeDelayForFailureInjection,
} from "./failureInjector";
import { runAllSecureWatchAgentValidators } from "../validators";

export function defaultScenariosDirectory(cwd?: string): string {
  const base = cwd ?? process.cwd();
  return path.join(base, "simulator", "scenarios");
}

/** Recursively collect `*.json` scenario fixtures (excludes dot-directories and node_modules). */
async function discoverScenarioJsonFiles(root: string): Promise<string[]> {
  const paths: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
      throw e;
    }

    for (const dent of entries) {
      const full = path.join(dir, dent.name);
      if (dent.isDirectory()) {
        if (dent.name.startsWith(".") || dent.name === "node_modules") continue;
        await walk(full);
        continue;
      }
      if (!dent.isFile() || !dent.name.endsWith(".json") || dent.name.startsWith(".")) continue;
      paths.push(full);
    }
  }

  await walk(root);
  paths.sort((a, b) => a.localeCompare(b));
  return paths;
}

export async function loadScenarioDefinitionsFromDirectory(
  dir?: string,
): Promise<ScenarioDefinition[]> {
  const root = dir ?? defaultScenariosDirectory();

  try {
    const files = await discoverScenarioJsonFiles(root);
    const defs: ScenarioDefinition[] = [];

    for (const full of files) {
      const raw = JSON.parse(await fs.readFile(full, "utf8"));
      try {
        defs.push(parseSimulationScenarioDocument(raw));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const label = path.relative(root, full) || full;
        throw new Error(`Invalid scenario fixture [${label}]: ${msg}`);
      }
    }

    defs.sort((a, b) => a.id.localeCompare(b.id));
    return defs;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

export async function loadScenarioDefinitionFile(filePath: string): Promise<ScenarioDefinition> {
  const raw = JSON.parse(await fs.readFile(path.resolve(filePath), "utf8"));
  return parseSimulationScenarioDocument(raw);
}

export function stampSimulatedEvents(
  scenario: ScenarioDefinition,
  runId: string,
  tenantMarker?: string,
): SimulatedEvent[] {
  return scenario.simulated_events.map((template, idx) => ({
    id: `evt-${runId}-${template.ref ?? String(idx)}`,
    scenarioId: scenario.id,
    runId,
    kind: template.kind,
    simulatedAt: new Date().toISOString(),
    ...(tenantMarker ? { tenantId: tenantMarker } : {}),
    payload: { ...template.payload },
    ...(template.metadata !== undefined ? { metadata: template.metadata } : {}),
  }));
}

function scenarioSkeletonForReport(scenario: ScenarioDefinition): Pick<Scenario, "id" | "name"> {
  return { id: scenario.id, name: scenario.name };
}

export interface RunScenarioOptions {
  scenariosDir?: string;
  scenarioPath?: string;
  mode?: SimulationMode;
  persistenceBaseDir?: string;
  /** Human JSON/Markdown reports; defaults to `simulator/reports/output` (or `SIMULATION_REPORT_OUTPUT_DIR`). */
  reportOutputDir?: string;
}

function pickEnvironment(mode: SimulationMode): SimulationRun["environment"] {
  const tag = process.env.SIMULATION_ENVIRONMENT?.trim();
  if (tag) return tag;
  if (mode === "supabase") return "staging-supabase-audit";
  if (mode === "inngest") return "staging-inngest";
  return "local";
}

/**
 * Execute a scenario definition discovered on disk through the simulator pipeline.
 */
export async function executeScenarioSimulation(
  scenario: ScenarioDefinition,
  options?: {
    mode?: SimulationMode;
    persistenceBaseDir?: string;
    reportOutputDir?: string;
  },
): Promise<
  SimulationLabReport & {
    persisted?: {
      resultPath?: string;
      reportPath?: string;
      humanReportJsonPath?: string;
      humanReportMarkdownPath?: string;
    };
  }
> {
  const runId = randomUUID();
  const mode = options?.mode ?? resolveSimulationMode();
  const stamped = applyDuplicateEventInjection(
    scenario,
    stampSimulatedEvents(
      scenario,
      runId,
      process.env.SIMULATION_TENANT_ID?.trim() ?? undefined,
    ),
  );

  const startedAt = new Date().toISOString();
  let correlationAccumulator: string[];
  const emissions = await emitSimulatedEvents(scenario, stamped, mode);

  correlationAccumulator = emissions
    .flatMap((e) => [
      ...(e.ingest !== undefined ? [JSON.stringify(sanitizeCorrelation(e.ingest))] : []),
      ...(e.auditLogId !== undefined ? [e.auditLogId] : []),
    ])
    .slice(0, 50);

  const windowStartIso = stamped[0]?.simulatedAt ?? startedAt;
  await observeDelayForFailureInjection(scenario);
  const signals = await observeAgentSignals({
    runId,
    mode,
    windowStartedAtIso: windowStartIso,
  });

  const run: SimulationRun = {
    id: runId,
    scenarioId: scenario.id,
    startedAt,
    completedAt: new Date().toISOString(),
    environment: pickEnvironment(mode),
    events: stamped,
    orchestrationCorrelationIds:
      correlationAccumulator.length > 0 ? correlationAccumulator : undefined,
  };

  let simulationResult = evaluateScenarioExpectations({ scenario, signals, runId });
  simulationResult = mergeFailureInjectionIntoSimulationResult(scenario, simulationResult);

  const report: SimulationLabReport = {
    generatedAt: simulationResult.finishedAt,
    scenario: scenarioSkeletonForReport(scenario),
    run: {
      id: run.id,
      startedAt: run.startedAt,
      ...(run.completedAt !== undefined ? { completedAt: run.completedAt } : {}),
      environment: run.environment,
    },
    result: simulationResult,
  };

  const securewatchAgents = injectAgentValidatorFailures(
    scenario,
    runAllSecureWatchAgentValidators({
      scenario,
      runId,
      signals,
      stampedEvents: stamped,
    }),
  );

  const autonomyScorecard = computeAutonomyScorecard({
    scenario,
    result: simulationResult,
    run,
    signals,
    securewatchAgents,
  });

  const humanReports = isReportGenerationFailureInjected(scenario)
    ? {
        jsonPath: "",
        markdownPath: "",
        skipped: {
          reason: "Synthetic report write failure (failure_injection: report_generation_failure).",
          injection_type: "report_generation_failure",
        },
      }
    : await writeSimulationRunReports({
        scenario,
        run,
        result: simulationResult,
        signals,
        emissions,
        autonomyScorecard,
        securewatchAgents,
        ...(options?.reportOutputDir !== undefined ? { outputDirectory: options.reportOutputDir } : {}),
      });

  const structuredReport = {
    ...buildStructuredSimulationReport(report, signals, emissions, scenario),
    securewatch_agents: securewatchAgents,
    autonomy_scorecard: autonomyScorecard,
    ...(humanReports.skipped
      ? {
          report_generation: {
            skipped: true as const,
            reason: humanReports.skipped.reason,
            injection_type: humanReports.skipped.injection_type,
          },
        }
      : {}),
  };

  const persistedBase = await persistSimulationArtifacts({
    run,
    result: simulationResult,
    report: structuredReport as unknown as Record<string, unknown>,
    baseDir: options?.persistenceBaseDir,
  });

  const persisted = {
    ...persistedBase,
    humanReportJsonPath: humanReports.jsonPath,
    humanReportMarkdownPath: humanReports.markdownPath,
  };

  return {
    ...report,
    persisted,
  };
}

/** Load every `*.json` scenario recursively from `{repo}/simulator/scenarios` (includes subdirs such as `golden-path/`) unless overridden. */
export async function executeAllScenarioSimulations(opts?: RunScenarioOptions) {
  const scenarioFiles = opts?.scenarioPath
    ? await loadScenarioDefinitionFile(opts.scenarioPath).then((s) => [s])
    : await loadScenarioDefinitionsFromDirectory(opts?.scenariosDir);

  const mode = opts?.mode ?? resolveSimulationMode();
  const out: Array<
    SimulationLabReport & { persisted?: { resultPath?: string; reportPath?: string } }
  > = [];

  for (const scenario of scenarioFiles) {
    out.push(
      await executeScenarioSimulation(scenario, {
        mode,
        persistenceBaseDir: opts?.persistenceBaseDir,
        reportOutputDir: opts?.reportOutputDir,
      }),
    );
  }
  return out;
}

/** Human + machine readable bundle for downstream dashboards */
export function buildStructuredSimulationReport(
  lab: SimulationLabReport,
  signals: CollectedSignals,
  emissions: EmitCorrelation[],
  scenario: ScenarioDefinition,
): Record<string, unknown> {
  const inj = failureInjectionTelemetry(scenario);
  return {
    lab,
    ...(inj ? { failure_injection: inj } : {}),
    telemetry: {
      simulation_mode_used: emissions[0]?.mode ?? resolveSimulationMode(),
      emissions: emissions.map((e) => ({
        mode: e.mode,
        auditLogId: e.auditLogId,
        ingest: e.ingest,
        inject_error: e.inject_error,
      })),
      observation: {
        polls: signals.pollIterations,
        window: {
          start: signals.observationWindowStartIso,
          end: signals.observationWindowEndIso,
        },
        audit_aligned_count: signals.auditRowsForRun.length,
      },
    },
    scenario_meta: {
      attack_category: scenario.attack_category,
      severity: scenario.severity,
      mitre_attack_techniques: scenario.mitre_attack_techniques,
      target_type: scenario.target_type,
      ...(scenario.golden_path_demo !== undefined
        ? { golden_path_demo: scenario.golden_path_demo }
        : {}),
    },
  };
}

function sanitizeCorrelation(ingest: unknown): Record<string, unknown> {
  if (typeof ingest === "object" && ingest !== null) return ingest as Record<string, unknown>;
  return { value: ingest };
}
