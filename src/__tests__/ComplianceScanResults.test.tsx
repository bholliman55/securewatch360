// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import ComplianceScanResults from "@/console/components/ComplianceScanResults";

describe("ComplianceScanResults", () => {
  it("renders readiness, control counts, gaps, and evidence-missing status", () => {
    render(
      <ComplianceScanResults
        summary={{
          readinessPercentage: 25,
          passedControls: 1,
          failedControls: 1,
          partialControls: 0,
          unknownControls: 2,
          totalControls: 4,
          topGaps: [
            {
              control_id: "CC4.1",
              control_name: "Monitoring activities",
              status: "unknown",
              severity: "medium",
              gap: "No authoritative evidence is available for this control.",
              recommended_action: "Connect logging evidence.",
            },
          ],
        }}
        results={[
          {
            id: "result-1",
            control_id: "CC4.1",
            control_name: "Monitoring activities",
            status: "unknown",
            evidence_status: "evidence_missing",
            severity: "medium",
            gap: "No authoritative evidence is available for this control.",
            recommended_action: "Connect logging evidence.",
          },
        ]}
      />
    );

    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByText("evidence_missing")).toBeInTheDocument();
    expect(screen.getByText("Connect logging evidence.")).toBeInTheDocument();
  });
});
