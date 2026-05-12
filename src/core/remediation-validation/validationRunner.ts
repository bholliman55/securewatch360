import { randomUUID } from "node:crypto";
import type { RemediationValidationPlan, ValidationRunContext, ValidationRunRecord, ValidationStep } from "./remediationValidation.schema";
import { remediationValidationPlanSchema, validationRunRecordSchema } from "./remediationValidation.schema";
import type { ValidationRegistry } from "./validationRegistry";
import type { ValidationResultStore } from "./validationResultStore";

function assignStepIds(steps: ValidationStep[]): ValidationStep[] {
  return steps.map((s) => ({
    ...s,
    step_id: s.step_id ?? randomUUID(),
  }));
}

export type ValidationRunnerHooks = {
  /** Append evidence / report artifacts when validation succeeds (non dry-run). */
  onSuccessEvidence?: (args: {
    record: ValidationRunRecord;
    plan: RemediationValidationPlan;
  }) => void;
  /** Failed validation — reopen or escalate incident in case system. */
  onFailureIncidentAction?: (args: {
    action: "reopen_incident" | "escalate_incident";
    record: ValidationRunRecord;
    plan: RemediationValidationPlan;
  }) => void;
};

/**
 * Executes ordered validation steps; drives incident reopen/escalate and evidence hooks on terminal state.
 */
export async function runValidationPlan(args: {
  plan: RemediationValidationPlan;
  context: ValidationRunContext;
  registry: ValidationRegistry;
  store: ValidationResultStore;
  hooks?: ValidationRunnerHooks;
}): Promise<ValidationRunRecord> {
  const plan = remediationValidationPlanSchema.parse(args.plan);
  const ctx = args.context;
  const run_id = randomUUID();
  const stepResults: ValidationRunRecord["step_results"] = [];
  const evidence_appendix: string[] = [];

  const sorted = assignStepIds([...plan.steps].sort((a, b) => a.order - b.order));
  let allOk = true;

  for (const step of sorted) {
    const stepStart = new Date().toISOString();
    const handler = args.registry.require(step.validation_type);
    let ok = true;
    let message = "";
    let evidence_ids: string[] = [];
    const simulated = ctx.dry_run || ctx.simulation_mode;

    try {
      const r = await handler({ step, context: ctx });
      ok = r.ok;
      message = r.message;
      evidence_ids = r.evidence_ids ?? [];
    } catch (e) {
      ok = false;
      message = e instanceof Error ? e.message : "validation_handler_error";
    }

    if (!ok) allOk = false;
    evidence_appendix.push(...evidence_ids);

    stepResults.push({
      step_id: step.step_id!,
      validation_type: step.validation_type,
      ok,
      message,
      evidence_ids,
      simulated,
      started_at: stepStart,
      completed_at: new Date().toISOString(),
    });
  }

  const outcome = allOk ? "success" : "failed";
  const incident_action = allOk
    ? "none"
    : plan.on_failure === "reopen_incident"
      ? "reopen_incident"
      : "escalate_incident";

  const report_summary = allOk
    ? `Post-remediation validation succeeded for action ${plan.action_type} (${stepResults.length} step(s)).`
    : `Post-remediation validation failed for action ${plan.action_type}. Incident should be ${incident_action.replace("_", " ")}.`;

  const record = validationRunRecordSchema.parse({
    run_id,
    plan_id: plan.plan_id,
    context: ctx,
    step_results: stepResults,
    outcome,
    incident_action,
    report_summary,
    evidence_appendix,
  });

  args.store.save(record);

  if (allOk && !ctx.dry_run && !ctx.simulation_mode) {
    args.hooks?.onSuccessEvidence?.({ record, plan });
  }
  if (!allOk && !ctx.dry_run && !ctx.simulation_mode && incident_action !== "none") {
    args.hooks?.onFailureIncidentAction?.({
      action: incident_action,
      record,
      plan,
    });
  }

  return record;
}
