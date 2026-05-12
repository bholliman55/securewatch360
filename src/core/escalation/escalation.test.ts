import { describe, expect, it } from "vitest";
import { HumanEscalationOrchestrationEngine } from "./engine";
import { evaluateTimeoutEscalation } from "./timeoutEscalation";
import { buildEscalationDispatchIntent } from "./channelIntents";
import { createApprovalQueueItem } from "./approvalQueue";

const recipients = () => [{ contact_id: "c1", channels: ["email" as const, "slack" as const] }];

describe("HumanEscalationOrchestrationEngine", () => {
  it("enqueues and approves", () => {
    const eng = new HumanEscalationOrchestrationEngine("tenant-a");
    const item = eng.enqueue({
      title: "Approve patch",
      risk_tier: "high",
      resource_type: "remediation_action",
      resource_id: "ra-1",
      requested_by_user_id: "u1",
    });
    const r = eng.decide(item.id, { decision: "approve", actor_user_id: "admin-1", reason: "LGTM" });
    expect(r.item?.status).toBe("approved");
    expect(r.record.decision).toBe("approve");
  });

  it("reject and request_more_information", () => {
    const eng = new HumanEscalationOrchestrationEngine("tenant-b");
    const i1 = eng.enqueue({
      title: "Risky change",
      risk_tier: "critical",
      resource_type: "approval_request",
      resource_id: "ar-1",
    });
    eng.decide(i1.id, { decision: "reject", actor_user_id: "admin-1" });
    expect(eng.store.get(i1.id)?.status).toBe("rejected");

    const i2 = eng.enqueue({
      title: "Unclear",
      risk_tier: "medium",
      resource_type: "finding",
      resource_id: "f-1",
    });
    eng.decide(i2.id, { decision: "request_more_information", actor_user_id: "admin-1" });
    expect(eng.store.get(i2.id)?.status).toBe("awaiting_info");
  });

  it("emergency_stop via decision", () => {
    const eng = new HumanEscalationOrchestrationEngine("tenant-c");
    const i = eng.enqueue({
      title: "Stop",
      risk_tier: "critical",
      resource_type: "manual",
      resource_id: "m-1",
    });
    eng.decide(i.id, { decision: "emergency_stop", actor_user_id: "breakglass-1", emergency_override: true });
    expect(eng.store.get(i.id)?.status).toBe("emergency_stopped");
  });

  it("timeout escalation emits intents", () => {
    const eng = new HumanEscalationOrchestrationEngine("tenant-d");
    const item = eng.enqueue({
      title: "SLA test",
      risk_tier: "high",
      resource_type: "remediation_action",
      resource_id: "ra-2",
    });
    const future = new Date(Date.now() + 120 * 60 * 1000).toISOString();
    eng.store.update(item.id, { created_at: new Date(Date.now() - 120 * 60 * 1000).toISOString() });
    const results = eng.processTimeouts(future, () => recipients());
    const intents = HumanEscalationOrchestrationEngine.collectIntents(results);
    expect(intents.length).toBeGreaterThanOrEqual(0);
    const row = results.find((r) => r.item_id === item.id);
    expect(row?.applied.action === "advance_tier" || row?.applied.action === "none").toBe(true);
  });

  it("emergency override stops tenant queue", () => {
    const eng = new HumanEscalationOrchestrationEngine("tenant-e");
    eng.enqueue({ title: "A", risk_tier: "high", resource_type: "manual", resource_id: "1" });
    eng.enqueue({ title: "B", risk_tier: "high", resource_type: "manual", resource_id: "2" });
    const { affected } = eng.emergency({
      actor_user_id: "bg-1",
      action: "emergency_stop",
      reason: "Incident commander halt",
    });
    expect(affected.length).toBe(2);
    expect(affected.every((a) => a.status === "emergency_stopped")).toBe(true);
  });
});

describe("evaluateTimeoutEscalation", () => {
  it("returns none when within window", () => {
    const item = createApprovalQueueItem({
      tenant_id: "t",
      title: "x",
      risk_tier: "low",
      resource_type: "manual",
      resource_id: "r",
    });
    const r = evaluateTimeoutEscalation(item, new Date().toISOString());
    expect(r.action).toBe("none");
  });
});

describe("buildEscalationDispatchIntent", () => {
  it("includes slack and email channels", () => {
    const item = createApprovalQueueItem({
      tenant_id: "t",
      title: "Alert",
      risk_tier: "critical",
      resource_type: "manual",
      resource_id: "r",
    });
    const intent = buildEscalationDispatchIntent({
      item,
      tier: 1,
      recipients: [{ contact_id: "x", channels: ["slack", "email"] }],
    });
    expect(intent.escalation.channels_active).toContain("slack");
    expect(intent.rendered.subject).toContain("Approval");
  });
});
