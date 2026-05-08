/**
 * Shared types for the Investor Mode UI. The components are dumb renderers
 * driven by props; the parent shell (`InvestorDemoShell`) owns state.
 */

import type {
  DemoActionRow,
  DemoAgentReasoningRow,
  DemoAssetRow,
  DemoClientRow,
  DemoEventRow,
  DemoMetricRow,
  DemoReportRow,
  DemoScenarioRow,
  InvestorDemoReplayState,
} from "@/demo/investorMode";

export interface ReplayStatusSnapshot {
  hasActive: boolean;
  state: InvestorDemoReplayState | null;
  scenarioKey: string | null;
  speedMultiplier: number | null;
  startedAt: string | null;
  emittedEventCount: number | null;
}

/** The state shape returned by `GET /api/demo/investor/state`. */
export interface InvestorDemoState {
  ok: boolean;
  scenarioKey: string;
  scenario: DemoScenarioRow | null;
  client: DemoClientRow | null;
  assets: DemoAssetRow[];
  events: DemoEventRow[];
  reasoning: DemoAgentReasoningRow[];
  actions: DemoActionRow[];
  metrics: DemoMetricRow[];
  reports: DemoReportRow[];
  replay: ReplayStatusSnapshot;
  errors: string[];
}

/** Empty starting snapshot, used before the first fetch resolves. */
export const EMPTY_INVESTOR_DEMO_STATE: InvestorDemoState = {
  ok: false,
  scenarioKey: "",
  scenario: null,
  client: null,
  assets: [],
  events: [],
  reasoning: [],
  actions: [],
  metrics: [],
  reports: [],
  replay: {
    hasActive: false,
    state: null,
    scenarioKey: null,
    speedMultiplier: null,
    startedAt: null,
    emittedEventCount: null,
  },
  errors: [],
};
