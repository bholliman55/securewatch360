import { randomUUID } from "node:crypto";
import type { OperatorBrief } from "./operatorBrief.schema";
import { operatorBriefSchema } from "./operatorBrief.schema";

export type IncidentNarrativeInput = {
  tenant_id: string;
  incident_id: string;
  /** Short labels only — never paste raw log lines here. */
  incident_title: string;
  severity_label: string;
  affected_assets_summary: string;
  primary_finding_summary: string;
  compliance_touchpoints?: string[];
  actions_taken_summary: string[];
  pending_approvals_summary: string[];
  failures_summary: string[];
  residual_risk_summary: string;
  suggested_next_steps: string[];
  priority_hint?: OperatorBrief["priority_hint"];
};

function joinBullets(lines: string[], emptyFallback: string): string {
  const filtered = lines.map((s) => s.trim()).filter(Boolean);
  if (filtered.length === 0) return emptyFallback;
  return filtered.map((l) => `• ${l}`).join("\n");
}

/**
 * Builds a calm operator brief with plain-English sections — callers supply distilled facts, not raw logs.
 */
export function buildIncidentOperatorBrief(input: IncidentNarrativeInput): OperatorBrief {
  const compliance =
    input.compliance_touchpoints?.filter(Boolean).length ?
      ` Relevant frameworks or controls mentioned in the record: ${input.compliance_touchpoints!.join(", ")}.`
      : "";

  const plain =
    `${input.incident_title} (${input.severity_label}). ` +
    `${input.primary_finding_summary} ` +
    `Scope: ${input.affected_assets_summary}.${compliance}`.trim();

  return operatorBriefSchema.parse({
    brief_id: randomUUID(),
    tenant_id: input.tenant_id,
    incident_id: input.incident_id,
    updated_at: new Date().toISOString(),
    plain_english_summary: plain.slice(0, 4000),
    what_happened: {
      headline: "What happened",
      detail: `${input.incident_title}. ${input.primary_finding_summary} Impact scope: ${input.affected_assets_summary}.`,
    },
    why_it_matters: {
      headline: "Why it matters",
      detail: `Severity is ${input.severity_label}. ${input.residual_risk_summary ? `Without timely action, ${input.residual_risk_summary}` : "Business and compliance exposure depends on how quickly containment and remediation complete."}`,
    },
    what_securewatch360_did: {
      headline: "What SecureWatch360 did",
      detail: joinBullets(input.actions_taken_summary, "Automated correlation and routing ran; no disruptive actions were executed without policy or approval."),
    },
    what_needs_approval: {
      headline: "What needs approval",
      detail: joinBullets(input.pending_approvals_summary, "No approvals are blocking progress right now."),
    },
    what_failed: {
      headline: "What failed",
      detail: joinBullets(input.failures_summary, "No integration or workflow failures were recorded for this incident slice."),
    },
    what_risk_remains: {
      headline: "What risk remains",
      detail: input.residual_risk_summary || "Residual risk will narrow after validation scans and control checks complete.",
    },
    what_happens_next: {
      headline: "What happens next",
      detail: joinBullets(input.suggested_next_steps, "Continue monitoring, validate remediation, and close the loop with evidence."),
    },
    priority_hint: input.priority_hint,
  });
}
