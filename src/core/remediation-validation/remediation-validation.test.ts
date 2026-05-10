import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { remediationValidationPlanSchema } from "./remediationValidation.schema";
import { createDefaultValidationRegistry } from "./validationRegistry";
import { ValidationResultStore } from "./validationResultStore";
import { runValidationPlan } from "./validationRunner";

const TENANT = "11111111-1111-4111-8111-111111111111";

function plan(action: "isolate_endpoint" | "close_port", on_failure: "reopen_incident" | "escalate_incident") {
  return remediationValidationPlanSchema.parse({
    plan_id: randomUUID(),
    tenant_id: TENANT,
    incident_id: "inc-1",
    remediation_action_id: "rem-1",
    action_type: action,
    on_failure,
    steps: [
      { order: 0, validation_type: "verify_endpoint_isolation", params: {} },
      { order: 1, validation_type: "rescan_asset", params: {} },
    ],
  });
}

describe("remediation-validation", () => {
  it("runs dry-run without incident or evidence hooks", async () => {
    const store = new ValidationResultStore();
    const reg = createDefaultValidationRegistry();
    const onFail = vi.fn();
    const onOk = vi.fn();
    const rec = await runValidationPlan({
      plan: plan("isolate_endpoint", "reopen_incident"),
      context: {
        tenant_id: TENANT,
        incident_id: "inc-1",
        remediation_action_id: "rem-1",
        dry_run: true,
        simulation_mode: false,
      },
      registry: reg,
      store,
      hooks: {
        onFailureIncidentAction: onFail,
        onSuccessEvidence: onOk,
      },
    });
    expect(rec.outcome).toBe("success");
    expect(rec.step_results.every((s) => s.simulated)).toBe(true);
    expect(onFail).not.toHaveBeenCalled();
    expect(onOk).not.toHaveBeenCalled();
  });

  it("invokes failure hook when a step fails (live mode)", async () => {
    const store = new ValidationResultStore();
    const reg = createDefaultValidationRegistry();
    reg.register("rescan_asset", async () => ({ ok: false, message: "scanner timeout" }));
    const onFail = vi.fn();
    const rec = await runValidationPlan({
      plan: plan("close_port", "escalate_incident"),
      context: {
        tenant_id: TENANT,
        incident_id: "inc-1",
        remediation_action_id: "rem-1",
        dry_run: false,
        simulation_mode: false,
      },
      registry: reg,
      store,
      hooks: { onFailureIncidentAction: onFail },
    });
    expect(rec.outcome).toBe("failed");
    expect(rec.incident_action).toBe("escalate_incident");
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(store.get(rec.run_id)?.outcome).toBe("failed");
  });

  it("invokes success evidence hook when all steps pass (live mode)", async () => {
    const store = new ValidationResultStore();
    const reg = createDefaultValidationRegistry();
    const onOk = vi.fn();
    const rec = await runValidationPlan({
      plan: plan("isolate_endpoint", "reopen_incident"),
      context: {
        tenant_id: TENANT,
        incident_id: "inc-1",
        remediation_action_id: "rem-1",
        dry_run: false,
        simulation_mode: false,
      },
      registry: reg,
      store,
      hooks: { onSuccessEvidence: onOk },
    });
    expect(rec.outcome).toBe("success");
    expect(onOk).toHaveBeenCalledTimes(1);
  });
});
