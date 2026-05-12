export type {
  TwinAsset,
  TwinVulnerability,
  TwinIdentity,
  TwinExposedService,
  TwinPolicyState,
  TwinCompliancePosture,
  TwinIncident,
  TwinRemediation,
  TwinAttackSurface,
  TwinSecurityPostureSnapshot,
  TwinSecurityPostureDiff,
  TwinEntityDiff,
  TwinAttackPath,
  TwinAttackPathStep,
  TwinSimulationOverlay,
} from "./types";

export {
  createSecurityPostureSnapshot,
  buildAttackSurface,
  computeRiskScore,
  type CreateSnapshotInput,
} from "./snapshot";

export { diffSnapshots } from "./diffEngine";

export { PostureHistoryStore, type PostureHistoryOptions } from "./postureHistory";

export { deriveAttackPathsFromSnapshot, diffAttackPathSets } from "./attackPathTracking";

export { playbackHistory, collectPlayback, type PlaybackFrame } from "./playback";

export { applySimulationOverlay, materializeTwinWithOverlay } from "./simulationOverlay";

export { DigitalTwinSecurityStateEngine } from "./twinEngine";
