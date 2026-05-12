/**
 * Explainability artifacts for SecureWatch360 agent and policy decisions.
 */

import type { DecisionAction, DecisionInput, DecisionOutput, DecisionReason } from "@/types/policy";

export const EXPLAINABILITY_SCHEMA_VERSION = "1.0.0";

/** Single piece of evidence in an auditable chain */
export type EvidenceChainNode = {
  id: string;
  kind:
    | "finding"
    | "scan_run"
    | "audit_log"
    | "policy_decision"
    | "remediation_action"
    | "external_intel"
    | "simulation_event"
    | "custom";
  ref_id: string;
  summary: string;
  captured_at?: string;
  /** Points to prior node in chain (optional DAG via single parent) */
  parent_node_id?: string | null;
  metadata?: Record<string, unknown>;
};

export type EvidenceChain = {
  root_node_id: string;
  nodes: EvidenceChainNode[];
};

/** Per-signal contribution to confidence (0–1 each); overall is separate */
export type ConfidenceBreakdown = {
  overall: number;
  factors: Array<{
    id: string;
    weight: number;
    score: number;
    rationale: string;
  }>;
  /** 0–100 for executive surfaces */
  overall_pct: number;
};

/** One step in a policy evaluation trace */
export type PolicyEvaluationTraceEntry = {
  step_index: number;
  source: "fallback_rules" | "opa" | "merged" | "guardrail" | "precedence";
  policy_id?: string | null;
  policy_name?: string | null;
  framework?: string | null;
  outcome: "matched" | "not_matched" | "error" | "skipped";
  detail: string;
  partial_decision?: Partial<DecisionOutput> | null;
};

export type PolicyEvaluationTrace = {
  entries: PolicyEvaluationTraceEntry[];
  engine_label: string;
};

/** Ordered narrative of how the decision was reached */
export type DecisionTraceStep = {
  order: number;
  phase: "input_normalization" | "policy_scan" | "merge" | "guardrails" | "remediation_routing" | "final";
  description: string;
  data?: Record<string, unknown>;
};

export type DecisionTrace = {
  steps: DecisionTraceStep[];
};

export type RemediationReasoning = {
  remediation_performed_or_recommended: boolean;
  narrative: string;
  /** Structured bullets for UI */
  bullets: string[];
  blocked_by?: Array<"human_approval" | "policy_block" | "guardrail" | "no_auto_path" | "finding_resolved">;
};

/** Full explainability bundle for one agent decision moment */
export type AgentDecisionExplanation = {
  schema_version: typeof EXPLAINABILITY_SCHEMA_VERSION;
  generated_at: string;
  tenant_id: string;
  correlation_id?: string | null;
  agent_or_workflow: string;
  /** Why the outcome occurred (plain language) */
  why_it_happened: string;
  evidence_chain: EvidenceChain;
  confidence: ConfidenceBreakdown;
  decision_trace: DecisionTrace;
  policy_evaluation_trace: PolicyEvaluationTrace;
  remediation_reasoning: RemediationReasoning;
  final_decision: DecisionOutput;
  decision_input_snapshot: DecisionInput;
};

export type BuildExplanationInput = {
  tenant_id: string;
  agent_or_workflow: string;
  correlation_id?: string | null;
  input: DecisionInput;
  output: DecisionOutput;
  /** Optional richer policy run (align with PolicyEvaluationResult) */
  policy_evaluation?: {
    engine: "fallback" | "opa" | "merged";
    matched_policy_count: number;
    errors?: string[];
    fallback_decision?: DecisionOutput | null;
    opa_decision?: DecisionOutput | null;
  };
  evidence_nodes?: EvidenceChainNode[];
  /** Human-readable override for why_it_happened */
  why_narrative?: string;
};
