import type { AiTaskKind } from "./aiDecision.schema";

export type ConfidenceGateResult = {
  passes: boolean;
  confidence_0_1: number;
  threshold: number;
  task_kind: AiTaskKind;
  reason?: string;
};

const DEFAULT_THRESHOLDS: Record<AiTaskKind, number> = {
  policy_explain: 0.55,
  finding_summary: 0.5,
  threat_narrative: 0.58,
  action_recommendation: 0.72,
  compliance_draft: 0.65,
};

/**
 * Blocks downstream automation when model confidence is below a task-specific floor.
 */
export function evaluateConfidenceGate(args: {
  task_kind: AiTaskKind;
  confidence_0_1: number;
  /** Optional override of the default threshold for this task. */
  threshold_override?: number;
}): ConfidenceGateResult {
  const threshold = args.threshold_override ?? DEFAULT_THRESHOLDS[args.task_kind];
  if (args.confidence_0_1 >= threshold) {
    return {
      passes: true,
      confidence_0_1: args.confidence_0_1,
      threshold,
      task_kind: args.task_kind,
    };
  }
  return {
    passes: false,
    confidence_0_1: args.confidence_0_1,
    threshold,
    task_kind: args.task_kind,
    reason: `confidence ${args.confidence_0_1.toFixed(3)} below required ${threshold} for ${args.task_kind}`,
  };
}

export function defaultConfidenceThreshold(task: AiTaskKind): number {
  return DEFAULT_THRESHOLDS[task];
}
