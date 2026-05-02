export type { SimulationLabReport } from "./report-types";

export {
  computeAutonomyScorecard,
  describeAutonomyReadiness,
  autonomyReadinessLabel,
  type AutonomyScorecard,
  type AutonomyScorecardInput,
  type AutonomyReadinessBand,
} from "./autonomyScorecard";

export {
  SIMULATION_RUN_REPORT_SCHEMA_VERSION,
  buildSimulationRunHumanReport,
  renderSimulationRunReportMarkdown,
  defaultSimulationReportOutputDir,
  writeSimulationRunReports,
  type SimulationRunHumanReport,
  type SimulationRunReportBuildInput,
  type WriteSimulationRunReportsResult,
} from "./reportGenerator";
