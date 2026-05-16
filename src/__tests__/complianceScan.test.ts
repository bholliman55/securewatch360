import { describe, expect, it } from "vitest";
import {
  evaluateComplianceControl,
  getComplianceFramework,
  summarizeComplianceResults,
} from "@/lib/complianceScan";

describe("compliance scan evaluation", () => {
  const relatedScanId = "00000000-0000-4000-8000-000000000001";

  it("supports the compliance scan framework values", () => {
    expect(getComplianceFramework("cmmc_l1")?.label).toBe("CMMC Level 1");
    expect(getComplianceFramework("cmmc_l2")?.label).toBe("CMMC Level 2");
    expect(getComplianceFramework("cis_v8")?.label).toBe("CIS Controls v8");
    expect(getComplianceFramework("nist_csf_2")?.label).toBe("NIST CSF 2.0");
    expect(getComplianceFramework("hipaa_security")?.label).toBe("HIPAA Security Rule");
    expect(getComplianceFramework("soc2")?.label).toBe("SOC 2");
  });

  it("marks missing evidence as unknown instead of pass", () => {
    const result = evaluateComplianceControl(
      "soc2",
      {
        control_code: "CC4.1",
        title: "Monitoring activities",
        description: "Monitor controls and collect evidence.",
      },
      {
        assetCount: null,
        openFindings: null,
        highCriticalFindings: null,
        policyCount: null,
        endpointCoverageKnown: false,
        mfaStatusKnown: false,
        backupStatusKnown: false,
        loggingMonitoringKnown: false,
        awarenessTrainingKnown: false,
      },
      relatedScanId,
      null
    );

    expect(result.status).toBe("unknown");
    expect(result.evidence_status).toBe("evidence_missing");
  });

  it("summarizes readiness without counting unknown controls as passed", () => {
    const pass = evaluateComplianceControl(
      "nist_csf_2",
      { control_code: "ID.RA-01", title: "Vulnerabilities are identified", description: null },
      {
        assetCount: 2,
        openFindings: 0,
        highCriticalFindings: 0,
        policyCount: 1,
        endpointCoverageKnown: false,
        mfaStatusKnown: false,
        backupStatusKnown: false,
        loggingMonitoringKnown: false,
        awarenessTrainingKnown: false,
      },
      relatedScanId,
      null
    );
    const unknown = evaluateComplianceControl(
      "nist_csf_2",
      { control_code: "PR.AT-01", title: "Security awareness training", description: null },
      {
        assetCount: 2,
        openFindings: 0,
        highCriticalFindings: 0,
        policyCount: 1,
        endpointCoverageKnown: false,
        mfaStatusKnown: false,
        backupStatusKnown: false,
        loggingMonitoringKnown: false,
        awarenessTrainingKnown: false,
      },
      relatedScanId,
      null
    );

    const summary = summarizeComplianceResults("nist_csf_2", [pass, unknown]);

    expect(summary.passedControls).toBe(1);
    expect(summary.unknownControls).toBe(1);
    expect(summary.readinessPercentage).toBe(50);
  });
});
