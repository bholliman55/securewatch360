/**
 * Explainability engine — assembles evidence chains, confidence, traces, and remediation narrative.
 */

import type { AgentDecisionExplanation, BuildExplanationInput } from "./types";
import { EXPLAINABILITY_SCHEMA_VERSION } from "./types";
import { buildDefaultEvidenceChain, mergeEvidenceNodes } from "./evidenceChain";
import { computeDecisionConfidence } from "./confidenceScore";
import { buildPolicyEvaluationTrace } from "./policyEvaluationTrace";
import { buildRemediationReasoning } from "./remediationReasoning";
import { buildDecisionTrace } from "./decisionTrace";

function buildWhyItHappened(input: BuildExplanationInput): string {
  if (input.why_narrative?.trim()) return input.why_narrative.trim();

  const codes = input.output.reasonCodes.join(", ");
  const action = input.output.action;
  return (
    `The ${input.agent_or_workflow} selected action "${action}" because: ${codes || "policy_not_matched"}. ` +
    `Approval required=${String(input.output.requiresApproval)}; ` +
    `auto remediation allowed=${String(input.output.autoRemediationAllowed)}.`
  );
}

/**
 * Produce a full explainability document for auditors and UI.
 */
export function buildAgentDecisionExplanation(input: BuildExplanationInput): AgentDecisionExplanation {
  const generated_at = new Date().toISOString();
  const baseChain = buildDefaultEvidenceChain(input.input);
  const evidence_chain = input.evidence_nodes?.length
    ? mergeEvidenceNodes(baseChain, input.evidence_nodes)
    : baseChain;

  const policy_evaluation_trace = buildPolicyEvaluationTrace({
    engine: input.policy_evaluation?.engine ?? "fallback",
    matched_policy_count: input.policy_evaluation?.matched_policy_count ?? input.output.matchedPolicies.length,
    errors: input.policy_evaluation?.errors,
    fallback_decision: input.policy_evaluation?.fallback_decision ?? null,
    opa_decision: input.policy_evaluation?.opa_decision ?? null,
    merged_decision: input.output,
  });

  const confidence = computeDecisionConfidence({
    input: input.input,
    output: input.output,
    policy_engine: input.policy_evaluation?.engine,
    evaluation_errors: input.policy_evaluation?.errors,
  });

  const decision_trace = buildDecisionTrace({
    input: input.input,
    output: input.output,
    policy_engine: input.policy_evaluation?.engine,
  });

  const remediation_reasoning = buildRemediationReasoning(input.output);

  return {
    schema_version: EXPLAINABILITY_SCHEMA_VERSION,
    generated_at,
    tenant_id: input.tenant_id,
    correlation_id: input.correlation_id ?? null,
    agent_or_workflow: input.agent_or_workflow,
    why_it_happened: buildWhyItHappened(input),
    evidence_chain,
    confidence,
    decision_trace,
    policy_evaluation_trace,
    remediation_reasoning,
    final_decision: input.output,
    decision_input_snapshot: input.input,
  };
}
