import { describe, expect, it } from "vitest";
import { buildApprovalSlaFields } from "@/lib/sla";

describe("buildApprovalSlaFields", () => {
  it("returns due and reminder timestamps and default escalation", () => {
    const now = "2026-01-01T00:00:00.000Z";
    const result = buildApprovalSlaFields(now);

    expect(result.escalationLevel).toBe(0);
    expect(new Date(result.slaDueAt).getTime()).toBeGreaterThan(new Date(now).getTime());
    expect(new Date(result.slaFirstReminderAt).getTime()).toBeGreaterThan(new Date(now).getTime());
    expect(new Date(result.slaFirstReminderAt).getTime()).toBeLessThan(new Date(result.slaDueAt).getTime());
  });
});
