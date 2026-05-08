/**
 * Voice intent → adapter registry.
 *
 * One source of truth for the binding between {@link VoiceIntent} values and
 * the function that actually does the work. The router and gateway depend
 * only on this registry — adding a new intent only requires:
 *
 *   1. Adding it to `VOICE_INTENTS` (in `../types.ts`),
 *   2. Declaring its safety level in `VOICE_INTENT_METADATA`,
 *   3. Implementing an adapter and listing it here.
 */

import type { VoiceIntent } from "../types";
import {
  complianceAdapter,
  criticalFindingsAdapter,
  clientRiskSummaryAdapter,
} from "./complianceAdapter";
import {
  disableUserAccountAdapter,
  incidentResponseAdapter,
  isolateEndpointAdapter,
} from "./incidentResponseAdapter";
import { remediationTicketAdapter } from "./remediationTicketAdapter";
import { reportAdapter } from "./reportAdapter";
import { scannerAdapter } from "./scannerAdapter";
import { vulnerabilityAdapter } from "./vulnerabilityAdapter";
import type { AdapterResult, VoiceAdapter } from "./types";

const unknownAdapter: VoiceAdapter = async () => ({
  success: false,
  spokenSummary:
    "I didn't catch a recognized SecureWatch command. Could you rephrase what you'd like me to do?",
  nextActions: [
    "Try phrases like 'run an external scan', 'show critical findings', or 'check compliance status'.",
  ],
  requiresFollowUp: true,
});

export const VOICE_ADAPTERS: Record<VoiceIntent, VoiceAdapter> = {
  RUN_EXTERNAL_SCAN: scannerAdapter,
  RUN_VULNERABILITY_SCAN: vulnerabilityAdapter,
  SHOW_CRITICAL_FINDINGS: criticalFindingsAdapter,
  SUMMARIZE_CLIENT_RISK: clientRiskSummaryAdapter,
  CHECK_COMPLIANCE_STATUS: complianceAdapter,
  GENERATE_EXECUTIVE_REPORT: reportAdapter,
  START_INCIDENT_RESPONSE: incidentResponseAdapter,
  ISOLATE_ENDPOINT: isolateEndpointAdapter,
  DISABLE_USER_ACCOUNT: disableUserAccountAdapter,
  CREATE_REMEDIATION_TICKET: remediationTicketAdapter,
  UNKNOWN: unknownAdapter,
};

export type { AdapterResult, VoiceAdapter };
export * from "./types";
