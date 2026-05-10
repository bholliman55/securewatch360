import { describe, expect, it } from "vitest";
import { runIdentitySecurityAgent } from "./identityAgent";
import { mockIdentityEventBatch } from "./mockIdentityEvents";
import { IDENTITY_SIGNAL_TYPES } from "./types";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("Identity Security Agent", () => {
  it("normalizes mixed IdP mocks, emits findings, risk score, remediation, and approval metadata", () => {
    const raw = mockIdentityEventBatch({ tenantId: TENANT });
    const report = runIdentitySecurityAgent({ tenant_id: TENANT, raw_events: raw });

    expect(report.tenant_id).toBe(TENANT);
    expect(report.events_normalized).toBe(raw.length);
    expect(report.sources_processed.length).toBeGreaterThan(0);
    expect(report.risk_score_0_100).toBeGreaterThanOrEqual(0);
    expect(report.risk_score_0_100).toBeLessThanOrEqual(100);
    expect(report.report_summary.length).toBeGreaterThan(20);

    expect(report.findings.length).toBeGreaterThan(0);
    for (const f of report.findings) {
      expect(IDENTITY_SIGNAL_TYPES).toContain(f.signal_type);
      expect(["low", "medium", "high", "critical"]).toContain(f.severity);
      expect(f.confidence).toBeGreaterThanOrEqual(0);
      expect(f.confidence).toBeLessThanOrEqual(1);
      expect(f.recommended_remediation.length).toBeGreaterThan(5);
      expect(["none", "analyst", "security_admin"]).toContain(f.required_approval);
      expect(f.evidence_event_ids.length).toBeGreaterThan(0);
    }

    const impossible = report.findings.find((f) => f.signal_type === "impossible_travel");
    expect(impossible?.title).toBeTruthy();

    const policy = report.findings.find((f) => f.signal_type === "new_admin_outside_policy");
    expect(policy?.required_approval).toBe("security_admin");
  });

  it("returns an empty finding set for empty input without throwing", () => {
    const report = runIdentitySecurityAgent({ tenant_id: TENANT, raw_events: [] });
    expect(report.findings).toEqual([]);
    expect(report.risk_score_0_100).toBe(0);
  });
});
