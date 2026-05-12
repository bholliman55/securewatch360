/**
 * Mock SecureWatch agent validator rows for autonomy / report generator tests.
 */

import type { AgentValidatorResult } from "../../validators/agentValidatorShared";
import {
  AGENT_1_ID,
  AGENT_2_ID,
  AGENT_3_ID,
  AGENT_4_ID,
  AGENT_5_ID,
} from "../../validators";

/** All five agents pass with full scores (deterministic lab stub). */
export const MOCK_AGENT_RESULTS_ALL_PASS: AgentValidatorResult[] = [
  { agentId: AGENT_1_ID, passed: true, score: 100, failures: [], warnings: [], evidence: {} },
  { agentId: AGENT_2_ID, passed: true, score: 100, failures: [], warnings: [], evidence: {} },
  { agentId: AGENT_3_ID, passed: true, score: 100, failures: [], warnings: [], evidence: {} },
  { agentId: AGENT_4_ID, passed: true, score: 100, failures: [], warnings: [], evidence: {} },
  { agentId: AGENT_5_ID, passed: true, score: 100, failures: [], warnings: [], evidence: {} },
];

/** Mixed outcome: one failing agent with checklist failures array populated. */
export const MOCK_AGENT_RESULTS_MIXED: AgentValidatorResult[] = [
  { agentId: AGENT_1_ID, passed: true, score: 90, failures: [], warnings: ["low_signal"], evidence: {} },
  { agentId: AGENT_2_ID, passed: false, score: 45, failures: ["intel_alignment_stub_miss"], warnings: [], evidence: {} },
  { agentId: AGENT_3_ID, passed: true, score: 80, failures: [], warnings: [], evidence: {} },
  { agentId: AGENT_4_ID, passed: true, score: 100, failures: [], warnings: [], evidence: {} },
  {
    agentId: AGENT_5_ID,
    passed: false,
    score: 40,
    failures: ["severity_correlation_miss"],
    warnings: [],
    evidence: {},
  },
];
