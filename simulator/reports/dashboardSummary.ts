/**
 * Compact summary object optimized for SecureWatch360 console dashboards and widgets.
 */

import type { CollectedSignals } from "../engineSignals.types";
import type { ScenarioDefinition } from "../schema";
import type { SimulationResult, SimulationRun } from "../types";
import type { EmitCorrelation } from "../engines/eventEmitter";
import type { AutonomyScorecard } from "./autonomyScorecard";
import { autonomyReadinessLabel } from "./autonomyScorecard";
import type { AgentValidatorResult } from "../validators/agentValidatorShared";
import { buildDemoTechnicalSummarySuffix } from "../fixtures/demoMode";

export type SimulationDashboardSummaryStatus = "passed" | "failed" | "partial";

/** One timeline slice for dashboards (playbook-derived or synthesized from stamped events). */
export interface SimulationDashboardTimelineEvent {
  t_offset_seconds: number;
  phase: string;
  narrative: string;
}

/** Shape consumed directly by SecureWatch360 UI dashboards. */
export interface SimulationDashboardSummary {
  schema_version: 1;
  generatedAtIso: string;
  runId: string;
  scenarioId: string;
  scenarioName: string;
  status: SimulationDashboardSummaryStatus;
  autonomyScore: number;
  autonomyReadinessLabel: string;
  agentsPassed: number;
  agentsFailed: number;
  remediationStatus: string;
  /** Plain-language rollup for control alignment (includes aggregation-controls gate). */
  controlsValidated: string;
  timelineEvents: SimulationDashboardTimelineEvent[];
  executiveSummary: string;
  technicalSummary: string;
  nextRecommendedAction: string;
  /** Present when `SIMULATION_DEMO_MODE` or runner `simulationDemoMode` forced fictitious client fixtures. */
  simulation_demo_mode?: boolean;
  demo_client_display_name?: string;
  demo_disclaimer?: string;
}

type PlaybookishScenario = ScenarioDefinition & {
  playbook_kind?: string;
  simulated_timeline?: ReadonlyArray<{
    t_offset_seconds: number;
    phase: string;
    synthetic_narrative: string;
  }>;
  expected_final_report?: {
    synthetic_executive_summary?: string;
  };
};

function isPlaybookWithTimeline(s: ScenarioDefinition): s is PlaybookishScenario {
  return (
    "playbook_kind" in s &&
    (s as PlaybookishScenario).playbook_kind === "safe_synthetic_lab" &&
    Array.isArray((s as PlaybookishScenario).simulated_timeline) &&
    (s as PlaybookishScenario).simulated_timeline!.length > 0
  );
}

function timelineFromScenario(
  scenario: ScenarioDefinition,
  run: Pick<SimulationRun, "startedAt" | "events">,
): SimulationDashboardTimelineEvent[] {
  if (isPlaybookWithTimeline(scenario)) {
    return scenario.simulated_timeline!.map((row) => ({
      t_offset_seconds: row.t_offset_seconds,
      phase: row.phase,
      narrative: row.synthetic_narrative,
    }));
  }

  const startMs = Date.parse(run.startedAt);
  return (run.events ?? []).map((e, idx) => {
    const t = Date.parse(e.simulatedAt);
    const offset =
      Number.isFinite(startMs) && Number.isFinite(t) ? Math.max(0, Math.round((t - startMs) / 1000)) : idx * 15;
    const title =
      typeof e.payload?.title === "string"
        ? e.payload.title
        : typeof e.payload?.subject === "string"
          ? e.payload.subject
          : e.kind;
    return {
      t_offset_seconds: offset,
      phase: e.kind,
      narrative: typeof title === "string" ? title : String(title),
    };
  });
}

function deriveExecutiveSummary(playbookish: ScenarioDefinition, result: SimulationResult): string {
  const pf = (playbookish as PlaybookishScenario).expected_final_report?.synthetic_executive_summary?.trim();
  if (pf) return pf;
  const pass = result.passed ? "PASS" : "FAIL";
  const ok = result.validations.filter((v) => v.passed).length;
  const n = result.validations.length;
  return `Synthetic run outcome=${pass}: ${ok}/${n} validation rows succeeded.`;
}

function deriveRemediationStatus(
  scenario: ScenarioDefinition,
  result: SimulationResult,
  autonomy: AutonomyScorecard,
): string {
  const hilNote =
    scenario.expected_remediation.human_in_the_loop === true ? " Human-in-the-loop gates still apply." : "";

  const ratePct = Math.round(clamp01(autonomy.remediation_success_rate) * 100);
  if (!result.passed) {
    return `Remediation is not validated for this scenario outcome — correlate audit/Inngest side-effects or review policy gates. Expected track: ${scenario.expected_remediation.summary.slice(
      0,
      200,
    )}${scenario.expected_remediation.summary.length > 200 ? "…" : ""}`;
  }
  if (ratePct >= 85) return `Remediation path satisfied indicators (${ratePct}% modeled success signal).${hilNote}`.trim();
  return `Remediation progressed with moderate residual friction (${ratePct}% modeled success signal).${hilNote}`.trim();
}

function deriveControlsValidated(result: SimulationResult, scenario: ScenarioDefinition): string {
  const row = result.validations.find((v) => v.expectationId === "aggregation-controls");
  const min = scenario.pass_fail_rules.min_controls_matched ?? 0;
  const expectedFamilies = scenario.expected_controls_triggered.length;
  const gate = row?.passed === true ? "passed" : "not satisfied";

  const parts = [
    `aggregation-controls gate ${gate}`,
    `${expectedFamilies} control family refs in scenario fixture`,
    `minimum match rule: ${min}`,
  ];

  if (row?.detail) parts.push(row.detail.slice(0, 280));

  return parts.join(" · ");
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

export function deriveDashboardSummaryStatus(
  result: SimulationResult,
  agents: AgentValidatorResult[],
): SimulationDashboardSummaryStatus {
  const failedAgents = agents.filter((a) => !a.passed).length;
  if (!result.passed) return "failed";
  if (failedAgents > 0) return "partial";
  return "passed";
}

function deriveTechnicalSummary(
  result: SimulationResult,
  signals: CollectedSignals,
  emissions: EmitCorrelation[],
  mode?: string,
  simulationDemo?: boolean,
): string {
  const ok = result.validations.filter((v) => v.passed).length;
  const total = result.validations.length;
  const m = mode ?? emissions[0]?.mode ?? "local";

  const inj = emissions.filter((e) => e.inject_error).length;

  const base = [
    `scenario_validations ${ok}/${total} passed`,
    `simulation_mode ${m}`,
    `emissions ${emissions.length}${inj ? ` (${inj} simulated emit faults)` : ""}`,
    `audit_aligned_rows ${signals.auditRowsForRun.length}`,
    `poll_iterations ${signals.pollIterations}`,
  ].join(" · ");

  if (simulationDemo) {
    return `${base} · ${buildDemoTechnicalSummarySuffix(m as "local" | "supabase" | "inngest")}`;
  }
  return base;
}

function demoExecutivePreamble(run: SimulationRun): string {
  if (!run.simulation_demo_mode || !run.demo_client_snapshot) return "";
  const d = run.demo_client_snapshot;
  return `[Demo rehearsal · simulated only · ${d.display_name}] Fictitious portfolio company (${d.vertical}). Assets use *.sw360-demo.invalid hostnames. Narrative is scripted for investor-grade clarity — not field SIEM/EDR ingest. `;
}

function deriveNextRecommendedAction(
  scenario: ScenarioDefinition,
  result: SimulationResult,
  agents: AgentValidatorResult[],
  autonomy: AutonomyScorecard,
  simulationDemo?: boolean,
): string {
  const failedAgents = agents.filter((a) => !a.passed);
  const names = failedAgents.map((a) => a.agentId.replace(/^agent-/i, "Agent ").slice(0, 42)).slice(0, 3);

  if (simulationDemo) {
    const base = (() => {
      if (!result.passed) {
        return "Flip `SIMULATION_DEMO_MODE` off and use supabase/inngest when you need correlation against a real lab tenant.";
      }
      if (failedAgents.length > 0) {
        return `Tune validator correlation for ${names.join(", ")}; confirm audit payloads include expected agent keywords for this tenant.`;
      }
      if (autonomy.overall_autonomy_score < 75) {
        return `Raise autonomy (score ${Math.round(autonomy.overall_autonomy_score)}): reduce human-intervention-heavy gates where policy allows or improve detection fidelity to trim false negatives.`;
      }
      return "Archive this demo bundle for pitches; keep investor language synchronized with product GA milestones.";
    })();
    return `${base} Production-style validation still requires turning demo mode off so orchestration sinks exercise your configured tenant.`;
  }

  if (!result.passed) {
    return "Rerun in supabase/inngest mode when credentials are available so audit correlation can satisfy sequencing expectations—or relax pass rules for purely local rehearsals.";
  }
  if (failedAgents.length > 0) {
    return `Tune validator correlation for ${names.join(", ")}; confirm audit payloads include expected agent keywords for this tenant.`;
  }
  if (autonomy.overall_autonomy_score < 75) {
    return `Raise autonomy (score ${Math.round(autonomy.overall_autonomy_score)}): reduce human-intervention-heavy gates where policy allows or improve detection fidelity to trim false negatives.`;
  }

  return "Archive this run bundle for investor evidence; schedule recurring golden-path scenarios to spotlight regression drift quarter over quarter.";
}

/** Build dashboard-friendly summary consumed by SecureWatch360 console UI. */
export function buildSimulationDashboardSummary(params: {
  scenario: ScenarioDefinition;
  run: SimulationRun;
  result: SimulationResult;
  autonomyScorecard: AutonomyScorecard;
  securewatchAgents: AgentValidatorResult[];
  signals: CollectedSignals;
  emissions: EmitCorrelation[];
  simulationMode?: string;
  simulationDemoMode?: boolean;
  demoClientDisplayName?: string;
}): SimulationDashboardSummary {
  const {
    scenario,
    run,
    result,
    autonomyScorecard,
    securewatchAgents,
    signals,
    emissions,
    simulationMode,
    simulationDemoMode,
    demoClientDisplayName,
  } = params;

  const agentsPassed = securewatchAgents.filter((a) => a.passed).length;
  const agentsFailed = securewatchAgents.length - agentsPassed;
  const status = deriveDashboardSummaryStatus(result, securewatchAgents);
  const mode = simulationMode ?? emissions[0]?.mode ?? "local";

  const remediationStatus = `${simulationDemoMode ? "[Simulated demo — live remediation execution blocked] " : ""}${deriveRemediationStatus(scenario, result, autonomyScorecard)}`;

  return {
    schema_version: 1,
    generatedAtIso: result.finishedAt,
    runId: run.id,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    status,
    autonomyScore: Math.round(autonomyScorecard.overall_autonomy_score),
    autonomyReadinessLabel: autonomyReadinessLabel(autonomyScorecard.readiness_band),
    agentsPassed,
    agentsFailed,
    remediationStatus,
    controlsValidated: deriveControlsValidated(result, scenario),
    timelineEvents: timelineFromScenario(scenario, run),
    executiveSummary: `${demoExecutivePreamble(run)}${deriveExecutiveSummary(scenario, result)}`,
    technicalSummary: deriveTechnicalSummary(result, signals, emissions, mode, simulationDemoMode),
    nextRecommendedAction: deriveNextRecommendedAction(
      scenario,
      result,
      securewatchAgents,
      autonomyScorecard,
      simulationDemoMode,
    ),
    ...(simulationDemoMode
      ? {
          simulation_demo_mode: true,
          demo_client_display_name: demoClientDisplayName ?? run.demo_client_snapshot?.display_name,
          demo_disclaimer:
            "Demonstration data only. Organizations, assets, and timelines are fictitious; remediation playbooks did not execute against customer infrastructure.",
        }
      : {}),
  };
}
