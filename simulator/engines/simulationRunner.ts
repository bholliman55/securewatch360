/**
 * Loads scenario JSON fixtures, validates via Zod, emits synthetic telemetry, observes responses, persists reports.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { scenarioDefinitionSchema, type ScenarioDefinition } from "../schema";
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
import { runAllSecureWatchAgentValidators } from "../validators";

export function defaultScenariosDirectory(cwd?: string): string {
  const base = cwd ?? process.cwd();
  return path.join(base, "simulator", "scenarios");
}

export async function loadScenarioDefinitionsFromDirectory(
  dir?: string,
): Promise<ScenarioDefinition[]> {
  const root = dir ?? defaultScenariosDirectory();

  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const defs: ScenarioDefinition[] = [];

    for (const dent of entries) {
      if (!dent.isFile() || !dent.name.endsWith(".json")) continue;
      if (dent.name.startsWith(".")) continue;
      const full = path.join(root, dent.name);
      const raw = JSON.parse(await fs.readFile(full, "utf8"));
      const parsed = scenarioDefinitionSchema.safeParse(raw);
      if (!parsed.success) {
        const msg = `[${dent.name}] ${JSON.stringify(parsed.error.format(), null, 2)}`;
        throw new Error(`Invalid scenario fixture: ${msg}`);
      }
      defs.push(parsed.data);
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
  const parsed = scenarioDefinitionSchema.safeParse(raw);
  if (!parsed.success) throw new Error(JSON.stringify(parsed.error.format(), null, 2));
  return parsed.data;
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
  options?: { mode?: SimulationMode; persistenceBaseDir?: string },
): Promise<SimulationLabReport & { persisted?: { resultPath?: string; reportPath?: string } }> {
  const runId = randomUUID();
  const mode = options?.mode ?? resolveSimulationMode();
  const stamped = stampSimulatedEvents(
    scenario,
    runId,
    process.env.SIMULATION_TENANT_ID?.trim() ?? undefined,
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

  const simulationResult = evaluateScenarioExpectations({ scenario, signals, runId });

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

  const structuredReport = {
    ...buildStructuredSimulationReport(report, signals, emissions, scenario),
    securewatch_agents: runAllSecureWatchAgentValidators({
      scenario,
      runId,
      signals,
      stampedEvents: stamped,
    }),
  };

  const persisted = await persistSimulationArtifacts({
    run,
    result: simulationResult,
    report: structuredReport as unknown as Record<string, unknown>,
    baseDir: options?.persistenceBaseDir,
  });

  return {
    ...report,
    persisted,
  };
}

/** Load every `*.json` scenario from `{repo}/simulator/scenarios` unless overridden. */
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
  return {
    lab,
    telemetry: {
      simulation_mode_used: emissions[0]?.mode ?? resolveSimulationMode(),
      emissions: emissions.map((e) => ({
        mode: e.mode,
        auditLogId: e.auditLogId,
        ingest: e.ingest,
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
    },
  };
}

function sanitizeCorrelation(ingest: unknown): Record<string, unknown> {
  if (typeof ingest === "object" && ingest !== null) return ingest as Record<string, unknown>;
  return { value: ingest };
}
