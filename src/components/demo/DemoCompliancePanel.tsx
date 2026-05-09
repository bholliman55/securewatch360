"use client";

/**
 * DemoCompliancePanel — surfaces the compliance frameworks in scope plus
 * the most recent compliance-impact reasoning from Agent 3.
 *
 * Renders cleanly even before any reasoning has been emitted: the panel
 * lists the frameworks pulled from the client row and shows a placeholder
 * line for the impact assessment until Agent 3 fires.
 */

import type {
  DemoAgentReasoningRow,
  DemoClientRow,
} from "@/demo/investorMode";

export interface DemoCompliancePanelProps {
  client: DemoClientRow | null;
  reasoning: ReadonlyArray<DemoAgentReasoningRow>;
}

export function DemoCompliancePanel({
  client,
  reasoning,
}: DemoCompliancePanelProps): React.JSX.Element {
  const frameworks = client?.compliance_frameworks?.length
    ? client.compliance_frameworks
    : ["HIPAA", "CMMC", "NIST CSF"];

  // Pick the *latest* reasoning that addresses compliance impact.
  const complianceReasoning = reasoning.find(
    (r) => r.event_type === "compliance_impact_assessed",
  );

  return (
    <section
      aria-labelledby="compliance-title"
      style={{
        borderRadius: 12,
        border: "1px solid rgba(41,182,246,0.2)",
        background: "#0d1e33",
        padding: "1rem 1.1rem",
        boxShadow: "0 14px 34px -20px rgba(0,0,0,0.55)",
      }}
    >
      <header>
        <h2
          id="compliance-title"
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 600,
            fontSize: "0.75rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#8ab4d4",
            margin: 0,
          }}
        >
          Compliance Impact
        </h2>
      </header>

      <ul
        style={{
          marginTop: "0.75rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.4rem",
          padding: 0,
          listStyle: "none",
        }}
      >
        {frameworks.map((fw) => (
          <li
            key={fw}
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 6,
              border: "1px solid rgba(41,182,246,0.25)",
              background: "rgba(41,182,246,0.07)",
              padding: "0.15rem 0.5rem",
              fontSize: "0.7rem",
              fontWeight: 600,
              color: "#29b6f6",
              letterSpacing: "0.04em",
            }}
          >
            {fw}
          </li>
        ))}
      </ul>

      <div
        style={{
          marginTop: "0.9rem",
          borderRadius: 8,
          border: "1px solid rgba(176,196,222,0.12)",
          background: "rgba(176,196,222,0.04)",
          padding: "0.65rem 0.85rem",
        }}
      >
        <h3
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#8ab4d4",
            margin: 0,
          }}
        >
          Agent 3 Impact Assessment
        </h3>
        {complianceReasoning ? (
          <>
            <p style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#cbd5e1", lineHeight: 1.5 }}>
              {complianceReasoning.reasoning_summary}
            </p>
            {complianceReasoning.confidence != null && (
              <p style={{ marginTop: "0.35rem", fontSize: "0.7rem", color: "#8ab4d4" }}>
                Confidence{" "}
                <span style={{ color: "#22c55e", fontWeight: 600 }}>
                  {Math.round((complianceReasoning.confidence as number) * 100)}%
                </span>
              </p>
            )}
          </>
        ) : (
          <p style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#8ab4d4", fontStyle: "italic" }}>
            Awaiting compliance impact assessment…
          </p>
        )}
      </div>

      <p style={{ marginTop: "0.75rem", fontSize: "0.7rem", color: "#8ab4d4", lineHeight: 1.45 }}>
        Containment events, voice approvals, and isolation actions are
        captured as evidence with timestamps and actor IDs (simulated).
      </p>
    </section>
  );
}
