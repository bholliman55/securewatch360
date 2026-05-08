import { describe, expect, it } from "vitest";

import {
  INVESTOR_DEMO_AGENTS,
  INVESTOR_DEMO_SCENARIO,
} from "../demoSeedData";

describe("INVESTOR_DEMO_SCENARIO — top-level metadata", () => {
  it("uses the canonical scenario_key + investor-friendly name", () => {
    expect(INVESTOR_DEMO_SCENARIO.scenario_key).toBe(
      "ransomware-precursor-acme-dental",
    );
    expect(INVESTOR_DEMO_SCENARIO.name).toBe(
      "Ransomware Precursor Attack - Acme Dental",
    );
    expect(INVESTOR_DEMO_SCENARIO.description).toMatch(/controlled simulation/i);
    expect(INVESTOR_DEMO_SCENARIO.description).toMatch(/MSP-managed healthcare client/i);
  });
});

describe("INVESTOR_DEMO_SCENARIO.client", () => {
  it("matches the spec exactly", () => {
    const c = INVESTOR_DEMO_SCENARIO.client;
    expect(c.client_name).toBe("Acme Dental");
    expect(c.industry).toBe("Healthcare");
    expect(c.employee_count).toBe(74);
    expect(c.msp_name).toBe("Northstar Managed IT");
    expect([...c.compliance_frameworks]).toEqual(["HIPAA", "CMMC", "NIST CSF"]);
  });

  it("flags itself as simulation-only in metadata", () => {
    expect(INVESTOR_DEMO_SCENARIO.client.metadata.simulation_only).toBe(true);
  });
});

describe("INVESTOR_DEMO_SCENARIO.agents", () => {
  it("includes all four named agents from the spec", () => {
    const names = INVESTOR_DEMO_SCENARIO.agents.map((a) => a.agent_name);
    expect(names).toEqual([
      "Agent 1: External Scanner",
      "Agent 2: Vulnerability Intelligence",
      "Agent 3: Compliance Guardian",
      "Agent 5: Threat Monitoring",
    ]);
  });

  it("agent registry is also exported as INVESTOR_DEMO_AGENTS", () => {
    expect(INVESTOR_DEMO_AGENTS.agent5.agent_name).toBe(
      "Agent 5: Threat Monitoring",
    );
    expect(INVESTOR_DEMO_AGENTS.agent2.agent_name).toBe(
      "Agent 2: Vulnerability Intelligence",
    );
    expect(INVESTOR_DEMO_AGENTS.agent3.agent_name).toBe(
      "Agent 3: Compliance Guardian",
    );
    expect(INVESTOR_DEMO_AGENTS.agent1.agent_name).toBe(
      "Agent 1: External Scanner",
    );
  });
});

describe("INVESTOR_DEMO_SCENARIO.assets", () => {
  it("contains exactly the four spec'd assets in order", () => {
    const summary = INVESTOR_DEMO_SCENARIO.assets.map((a) => ({
      name: a.asset_name,
      type: a.asset_type,
      risk: a.risk_level,
      status: a.status,
    }));
    expect(summary).toEqual([
      { name: "ACME-FS01", type: "file_server", risk: "critical", status: "healthy" },
      { name: "LAPTOP-123", type: "endpoint", risk: "high", status: "healthy" },
      { name: "VPN-GATEWAY-01", type: "network_gateway", risk: "medium", status: "healthy" },
      { name: "M365-TENANT", type: "cloud_identity", risk: "high", status: "healthy" },
    ]);
  });
});

describe("INVESTOR_DEMO_SCENARIO.timeline", () => {
  it("has 15 events in 1-indexed order", () => {
    expect(INVESTOR_DEMO_SCENARIO.timeline).toHaveLength(15);
    const orders = INVESTOR_DEMO_SCENARIO.timeline.map((e) => e.event_order);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it("uses the exact offsets from the spec", () => {
    const offsets = INVESTOR_DEMO_SCENARIO.timeline.map((e) => e.offset_seconds);
    expect(offsets).toEqual([0, 3, 6, 9, 12, 15, 18, 21, 24, 30, 33, 37, 42, 48, 55]);
  });

  it("offsets are strictly non-decreasing", () => {
    for (let i = 1; i < INVESTOR_DEMO_SCENARIO.timeline.length; i += 1) {
      const prev = INVESTOR_DEMO_SCENARIO.timeline[i - 1]!;
      const cur = INVESTOR_DEMO_SCENARIO.timeline[i]!;
      expect(cur.offset_seconds).toBeGreaterThanOrEqual(prev.offset_seconds);
    }
  });

  it("starts with demo_started and ends with demo_completed", () => {
    expect(INVESTOR_DEMO_SCENARIO.timeline[0]!.event_type).toBe("demo_started");
    expect(INVESTOR_DEMO_SCENARIO.timeline.at(-1)!.event_type).toBe(
      "demo_completed",
    );
  });

  it("assigns the right agent to each agent-driven event", () => {
    const byEventType = new Map(
      INVESTOR_DEMO_SCENARIO.timeline.map((e) => [e.event_type, e]),
    );
    expect(byEventType.get("agent_classification")?.agent_name).toBe(
      INVESTOR_DEMO_AGENTS.agent5.agent_name,
    );
    expect(byEventType.get("agent_correlation")?.agent_name).toBe(
      INVESTOR_DEMO_AGENTS.agent2.agent_name,
    );
    expect(byEventType.get("agent_compliance_check")?.agent_name).toBe(
      INVESTOR_DEMO_AGENTS.agent3.agent_name,
    );
    expect(byEventType.get("containment_recommended")?.agent_name).toBe(
      INVESTOR_DEMO_AGENTS.agent5.agent_name,
    );
  });

  it("every payload is flagged simulated:true", () => {
    for (const e of INVESTOR_DEMO_SCENARIO.timeline) {
      expect(e.payload.simulated).toBe(true);
    }
  });

  it("severities are drawn from the closed enum", () => {
    const allowed = new Set(["info", "low", "medium", "high", "critical"]);
    for (const e of INVESTOR_DEMO_SCENARIO.timeline) {
      expect(allowed.has(e.severity)).toBe(true);
    }
  });
});

describe("INVESTOR_DEMO_SCENARIO.reasoning", () => {
  it("captures the spec'd reasoning summaries verbatim", () => {
    const byAgent = new Map(
      INVESTOR_DEMO_SCENARIO.reasoning.map((r) => [r.agent_name, r]),
    );

    expect(byAgent.get(INVESTOR_DEMO_AGENTS.agent5.agent_name)?.reasoning_summary).toBe(
      "Detected suspicious PowerShell behavior, abnormal file access, and credential access signals. Pattern matches ransomware precursor behavior.",
    );
    expect(byAgent.get(INVESTOR_DEMO_AGENTS.agent2.agent_name)?.reasoning_summary).toBe(
      "Correlated observed behavior with known attacker tradecraft patterns and found elevated risk due to exposed remote access history.",
    );
    expect(byAgent.get(INVESTOR_DEMO_AGENTS.agent3.agent_name)?.reasoning_summary).toBe(
      "Detected potential HIPAA security rule impact and CMMC evidence requirements. Logging, containment, and incident documentation are required.",
    );
  });

  it("confidence is null or in [0,1]", () => {
    for (const r of INVESTOR_DEMO_SCENARIO.reasoning) {
      if (r.confidence !== null) {
        expect(r.confidence).toBeGreaterThanOrEqual(0);
        expect(r.confidence).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("INVESTOR_DEMO_SCENARIO.containment_recommendation", () => {
  it("matches the spec exactly", () => {
    expect(INVESTOR_DEMO_SCENARIO.containment_recommendation).toBe(
      "Isolate LAPTOP-123 from the network, preserve forensic logs, create remediation ticket, and generate executive report.",
    );
  });
});

describe("INVESTOR_DEMO_SCENARIO.metrics", () => {
  it("includes all 7 spec'd metrics with the expected values", () => {
    const byKey = new Map(
      INVESTOR_DEMO_SCENARIO.metrics.map((m) => [m.metric_key, m]),
    );

    expect(byKey.get("time_to_detection")?.metric_value).toBe("12 seconds");
    expect(byKey.get("time_to_containment")?.metric_value).toBe("33 seconds");
    expect(byKey.get("analyst_touches_required")?.metric_value).toBe(
      "1 approval",
    );
    expect(byKey.get("manual_work_avoided")?.metric_value).toMatch(/3-5 hours/);
    expect(byKey.get("incident_cost_avoided")?.metric_value).toMatch(/\$42,000\+/);
    expect(byKey.get("incident_cost_avoided")?.metric_value).toMatch(/illustrative/i);
    expect(byKey.get("compliance_evidence_generated")?.metric_value).toBe("Yes");
    expect(byKey.get("client_impact")?.metric_value).toMatch(/lateral movement/i);
  });

  it("sort_order is unique and 1-indexed", () => {
    const orders = INVESTOR_DEMO_SCENARIO.metrics.map((m) => m.sort_order);
    expect(new Set(orders).size).toBe(orders.length);
    expect(Math.min(...orders)).toBe(1);
  });
});

describe("INVESTOR_DEMO_SCENARIO.executive_summary", () => {
  it("matches the spec verbatim", () => {
    expect(INVESTOR_DEMO_SCENARIO.executive_summary).toBe(
      "SecureWatch360 detected ransomware precursor behavior against Acme Dental, " +
        "correlated the activity across multiple security signals, requested confirmation " +
        "for containment, simulated isolation of the affected endpoint, created remediation " +
        "evidence, and generated an executive-ready incident summary.",
    );
  });

  it('uses "simulated" language and avoids real-prevention claims', () => {
    expect(INVESTOR_DEMO_SCENARIO.executive_summary).toMatch(/simulated/i);
    expect(INVESTOR_DEMO_SCENARIO.executive_summary).not.toMatch(/prevented/i);
    expect(INVESTOR_DEMO_SCENARIO.executive_summary).not.toMatch(/blocked/i);
    expect(INVESTOR_DEMO_SCENARIO.executive_summary).not.toMatch(/stopped a real/i);
  });
});
