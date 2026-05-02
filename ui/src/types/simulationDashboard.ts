/** Mirrors `SimulatorDashboardSummary` from `simulator/reports/dashboardSummary.ts` — keep fields aligned when extending. */

export type SimulationDashboardSummaryStatus = "passed" | "failed" | "partial";

export interface SimulationDashboardTimelineEventUi {
  t_offset_seconds: number;
  phase: string;
  narrative: string;
}

export interface SimulationDashboardSummaryUi {
  schema_version?: 1;
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
  controlsValidated: string;
  timelineEvents: SimulationDashboardTimelineEventUi[];
  executiveSummary: string;
  technicalSummary: string;
  nextRecommendedAction: string;
}
