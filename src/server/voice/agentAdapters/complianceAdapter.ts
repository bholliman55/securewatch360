/**
 * Voice → Agent 3 (compliance status) adapter.
 *
 * Two responsibilities depending on intent:
 *
 *   1. CHECK_COMPLIANCE_STATUS — read-only summary call. We invoke the
 *      existing `runComplianceStatus` service directly so the speaker hears
 *      the actual posture in the same turn (rather than getting a "I queued
 *      a compliance check" non-answer).
 *
 *   2. SUMMARIZE_CLIENT_RISK — combines findings (`runRiskQuery`) with
 *      compliance posture (`runComplianceStatus`) into one spoken sentence.
 *      This is the cross-section the user requested for client risk
 *      summaries.
 *
 * Both paths use injected service functions so the unit tests stay fully
 * isolated from Supabase. Defaults pull the real services in production.
 */

import {
  runComplianceStatus,
  type ComplianceStatusInput,
  type ComplianceStatusResult,
} from "@/agents/agent3-compliance/complianceStatusService";
import {
  runRiskQuery,
  type RiskQueryInput,
  type RiskQueryResult,
} from "@/agents/agent4-risk/riskQueryService";

import type { AdapterResult, VoiceAdapter } from "./types";
import { resolveNewId } from "./shared";

export interface ComplianceAdapterDeps {
  runComplianceStatus?: (input: ComplianceStatusInput) => Promise<ComplianceStatusResult>;
  runRiskQuery?: (input: RiskQueryInput) => Promise<RiskQueryResult>;
}

interface ContextWithDeps {
  complianceDeps?: ComplianceAdapterDeps;
}

function pickServices(deps: ComplianceAdapterDeps | undefined) {
  return {
    compliance: deps?.runComplianceStatus ?? runComplianceStatus,
    risk: deps?.runRiskQuery ?? runRiskQuery,
  };
}

function postureSentence(framework: string | undefined, result: ComplianceStatusResult): string {
  const fw = framework ?? "your overall compliance posture";
  const { posture, controls } = result;
  if (controls.total === 0) {
    return `I don't see any compliance controls indexed for ${fw} yet.`;
  }
  return `Compliance posture for ${fw} is ${posture}: ${controls.passing} of ${controls.total} controls passing, ${controls.failing} failing.`;
}

export const complianceAdapter: VoiceAdapter = async (context) => {
  const ctx = context as typeof context & ContextWithDeps;
  const services = pickServices(ctx.complianceDeps);
  const newId = resolveNewId(context.deps);
  const framework = context.slots.framework;

  try {
    const status = await services.compliance({
      scanId: newId(),
      tenantId: context.tenantId,
      clientId: context.slots.clientId,
      framework,
    });

    const result: AdapterResult = {
      success: true,
      spokenSummary: postureSentence(framework, status),
      data: { payload: status },
      nextActions:
        status.posture === "weak" || status.posture === "critical"
          ? ["Ask me to list critical findings driving the gap."]
          : [],
    };
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "compliance lookup failed";
    return {
      success: false,
      spokenSummary: "I couldn't pull the compliance posture just now. The audit log has the error.",
      data: { payload: { error: message } },
    };
  }
};

/**
 * `SHOW_CRITICAL_FINDINGS` — quick read of the top high/critical findings.
 * Calls the existing `runRiskQuery` service so the voice answer matches what
 * the analyst dashboard would render.
 */
export const criticalFindingsAdapter: VoiceAdapter = async (context) => {
  const ctx = context as typeof context & ContextWithDeps;
  const services = pickServices(ctx.complianceDeps);
  const newId = resolveNewId(context.deps);
  const requestedSeverity = context.slots.severity ?? "critical";

  try {
    const findings = await services.risk({
      scanId: newId(),
      tenantId: context.tenantId,
      clientId: context.slots.clientId,
      severity: requestedSeverity,
      limit: 5,
    });

    if (findings.totalFindings === 0) {
      return {
        success: true,
        spokenSummary: `No open ${requestedSeverity} findings right now.`,
        data: { payload: findings },
      };
    }

    const top = findings.topFindings[0];
    const summary =
      `${findings.totalFindings} ${requestedSeverity} findings open` +
      (top ? `; top one: ${top.title}.` : ".");

    return {
      success: true,
      spokenSummary: summary,
      data: { payload: findings },
      nextActions: ["Say 'create a remediation ticket for finding <id>' to escalate one of these."],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "findings query failed";
    return {
      success: false,
      spokenSummary: "I couldn't pull the critical findings just now. The audit log has the error.",
      data: { payload: { error: message } },
    };
  }
};

/**
 * `SUMMARIZE_CLIENT_RISK` — fan out compliance + findings in parallel and
 * fold them into one sentence. Scoped to top severity so the speaker hears
 * the most actionable signal first.
 */
export const clientRiskSummaryAdapter: VoiceAdapter = async (context) => {
  const ctx = context as typeof context & ContextWithDeps;
  const services = pickServices(ctx.complianceDeps);
  const newId = resolveNewId(context.deps);

  try {
    const [findings, compliance] = await Promise.all([
      services.risk({
        scanId: newId(),
        tenantId: context.tenantId,
        clientId: context.slots.clientId,
        severity: context.slots.severity,
        limit: 5,
      }),
      services.compliance({
        scanId: newId(),
        tenantId: context.tenantId,
        clientId: context.slots.clientId,
      }),
    ]);

    const sev = findings.bySeverity;
    const top = sev.critical || sev.high || sev.medium || sev.low;
    const headline =
      sev.critical > 0
        ? `${sev.critical} critical findings open`
        : sev.high > 0
          ? `${sev.high} high findings open`
          : top > 0
            ? `${top} non-critical findings open`
            : "no open findings";

    const spoken = `Client risk: ${headline}, compliance posture is ${compliance.posture}.`;

    return {
      success: true,
      spokenSummary: spoken,
      data: { payload: { findings, compliance } },
      nextActions:
        sev.critical + sev.high > 0
          ? ["Say 'show critical findings' for the top items."]
          : ["Say 'check compliance status' for a deeper dive."],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "risk summary failed";
    return {
      success: false,
      spokenSummary:
        "I couldn't compute the client risk summary just now. The audit log has the error.",
      data: { payload: { error: message } },
    };
  }
};
