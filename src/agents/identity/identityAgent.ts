import { runAllIdentityDetectors, scoreIdentityRiskFromFindings } from "./identityDetectors";
import { normalizeIdentityPayload } from "./identityNormalizer";
import type { IdentityAgentInput, IdentityAgentReport, IdentityFinding } from "./types";

function buildReportSummary(findings: IdentityFinding[], risk_score_0_100: number): string {
  const lines: string[] = [
    `Identity posture snapshot — composite risk score ${risk_score_0_100}/100.`,
    `Findings: ${findings.length}.`,
  ];
  const bySev = { critical: 0, high: 0, medium: 0, low: 0 } as const;
  type Sev = keyof typeof bySev;
  const counts: Record<Sev, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    counts[f.severity as Sev] += 1;
  }
  lines.push(`Severity mix — critical: ${counts.critical}, high: ${counts.high}, medium: ${counts.medium}, low: ${counts.low}.`);
  const top = findings.slice(0, 5).map((f) => `- ${f.title} (${f.signal_type}, ${f.severity})`);
  if (top.length) lines.push("Top signals:", ...top);
  lines.push(
    "Recommended program actions: enforce phishing-resistant MFA, tighten CA policies for admin surfaces, monitor OAuth consent, and maintain JIT/PAM for privileged roles.",
  );
  return lines.join("\n");
}

/**
 * SecureWatch360 Identity Security Agent — consumes IdP-shaped logs (Entra, Google, Okta, Duo, or simulated),
 * emits scored findings, remediation guidance, and approval requirements.
 */
export function runIdentitySecurityAgent(input: IdentityAgentInput): IdentityAgentReport {
  const normalized = input.raw_events.map((row) =>
    normalizeIdentityPayload(input.tenant_id, row.source, row.payload),
  );
  const findings = runAllIdentityDetectors(normalized);
  const risk_score_0_100 = scoreIdentityRiskFromFindings(findings);
  const report_summary = buildReportSummary(findings, risk_score_0_100);

  return {
    generated_at: new Date().toISOString(),
    tenant_id: input.tenant_id,
    sources_processed: [...new Set(normalized.map((e) => e.source))],
    events_normalized: normalized.length,
    findings,
    risk_score_0_100,
    report_summary,
  };
}
