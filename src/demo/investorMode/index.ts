/**
 * Public barrel for the investor demo simulation module.
 *
 * Consumers (API routes, UI panels, QA scripts) should import from this
 * file — never reach into the individual files. The internals are free
 * to refactor as long as the public surface stays stable.
 */

export {
  DEMO_SCENARIO_ID,
  DEMO_TENANT_ID,
  DEFAULT_DEMO_SPEED_MULTIPLIER,
  resolveDemoSink,
  createInMemoryDemoSink,
} from "./demoConfig";

export {
  ACME_DENTAL,
  ACME_FS01,
  SARAH_MITCHELL,
  LAPTOP_123,
  STALE_RDP_EXPOSURE,
  IMPACTED_CONTROLS,
  getDemoSeed,
  INVESTOR_DEMO_SCENARIO,
  INVESTOR_DEMO_AGENTS,
  type DemoClient,
  type DemoAsset,
  type DemoUser,
  type DemoEndpoint,
  type DemoExposure,
  type DemoComplianceControl,
  type DemoSeedSnapshot,
  type InvestorDemoScenario,
  type InvestorDemoAgent,
  type InvestorDemoClientShape,
  type InvestorDemoAssetShape,
  type InvestorDemoTimelineEvent,
  type InvestorDemoAgentReasoning,
  type InvestorDemoMetric,
} from "./demoSeedData";

export {
  DEMO_VOICE_SCRIPT,
  VOICE_CONFIRMATION_PROMPT,
  VOICE_ADMIN_CONFIRMATION,
  VOICE_AGENT_CLOSEOUT,
  getDemoVoiceLine,
  type DemoVoiceLine,
} from "./demoVoiceFixtures";

export {
  DEMO_TIMELINE,
  DEMO_TOTAL_DURATION_SECONDS,
  DEMO_HEADLINE,
  DEMO_SCENARIO_META,
  assertTimelineInvariants,
  type DemoScenarioMeta,
} from "./demoScenario";

export {
  startDemoReplay,
  createManualDemoReplay,
  runDemoReplaySynchronously,
  type ReplayHandle,
  type ReplayStartOptions,
  type ManualReplayHandle,
  type ManualReplayOptions,
  type ReplayClock,
} from "./demoReplayEngine";

export {
  computeDemoMetrics,
  formatDemoMetricsForDisplay,
  type DemoMetrics,
} from "./demoMetricsService";

export {
  buildExecutiveReport,
  buildBusinessImpactSummary,
  buildAllDemoReports,
  type ExecutiveReport,
  type ExecutiveReportSection,
  type BusinessImpactSummary,
  type BusinessImpactMetric,
} from "./demoReportService";

export {
  resetDemo,
  runResetCli,
  type ResetDemoOptions,
  type ResetDemoResult,
} from "./demoResetService";

export {
  DEMO_EVENT_TYPES,
  DEMO_EVENT_SEVERITIES,
  DEMO_EVENT_ACTORS,
  type DemoEvent,
  type DemoEventType,
  type DemoEventSeverity,
  type DemoEventActor,
  type DemoAgentLabel,
  type DemoTimelineStep,
  type DemoEventSink,
} from "./demoEventTypes";

export {
  createDemoRepository,
  seedDemoScenario,
  resetDemoScenario,
  getDemoTimeline,
  emitDemoEvent,
  updateDemoAction,
  getDemoMetrics,
  createDemoReport,
  upsertDemoMetricsBulk,
  type DemoRepository,
  type DemoScenarioRow,
  type DemoClientRow,
  type DemoAssetRow,
  type DemoEventRow,
  type DemoAgentReasoningRow,
  type DemoActionRow,
  type DemoReportRow,
  type DemoMetricRow,
  type SeedDemoScenarioInput,
  type EmitDemoEventInput,
  type UpdateDemoActionInput,
  type CreateDemoReportInput,
  type ResetDemoScenarioResult,
} from "./demoRepository";
