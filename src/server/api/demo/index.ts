/**
 * Public surface of the `/api/demo/*` service layer. Route handlers in
 * `src/app/api/demo/*` import from this barrel; tests import the
 * individual modules directly so they can stub deps.
 */

export { handleSeed } from "./seed";
export { handleReset } from "./reset";
export { handleStart } from "./start";
export { handleStatus } from "./status";
export { handleEvents } from "./events";
export { handleReport, buildSummary } from "./report";
export { handleVoiceCommand, classifyVoiceCommand } from "./voice-command";

export type {
  DemoServiceDeps,
  ReplayStoreLike,
  SeedResult,
  ResetResult,
  StartInput,
  StartResult,
  StatusResult,
  EventsResult,
  ReportResult,
  VoiceCommandInput,
  VoiceCommandResult,
  VoiceActionResult,
  VoiceIntent,
} from "./types";
export { VOICE_INTENTS } from "./types";
