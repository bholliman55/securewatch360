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
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <header>
        <h2
          id="compliance-title"
          className="text-base font-semibold text-gray-900"
        >
          Compliance impact
        </h2>
      </header>

      <ul className="mt-4 flex flex-wrap gap-2">
        {frameworks.map((fw) => (
          <li
            key={fw}
            className="inline-flex items-center rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700"
          >
            {fw}
          </li>
        ))}
      </ul>

      <div className="mt-5 rounded-lg border border-gray-100 bg-gray-50/60 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Agent 3 impact assessment
        </h3>
        {complianceReasoning ? (
          <>
            <p className="mt-1.5 text-sm text-gray-800">
              {complianceReasoning.reasoning_summary}
            </p>
            {complianceReasoning.confidence != null && (
              <p className="mt-1 text-xs text-gray-500">
                Confidence{" "}
                {Math.round(
                  (complianceReasoning.confidence as number) * 100,
                )}
                %
              </p>
            )}
          </>
        ) : (
          <p className="mt-1.5 text-sm text-gray-500">
            Awaiting compliance impact assessment…
          </p>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Containment events, voice approvals, and isolation actions are
        captured as evidence with timestamps and actor IDs (simulated).
      </p>
    </section>
  );
}
