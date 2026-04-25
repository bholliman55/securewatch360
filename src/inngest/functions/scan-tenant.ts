import { getSupabaseAdminClient } from "@/lib/supabase";
import { writeAuditLog } from "@/lib/audit";
import { SCAN_RUN_STATUSES } from "@/lib/statuses";
import { evaluateDecision } from "@/lib/decisionEngine";
import { createScanCompletionEvidence } from "@/lib/evidence";
import { recordCvesForFindings } from "@/lib/cveCatalog";
import { runComplianceAgentHook } from "@/lib/complianceAgent";
import { routeRemediationCandidate } from "@/lib/remediationAgent";
import { buildAwarenessTrainingPlan } from "@/lib/securityAwareness";
import { getLatestAwarenessSignals } from "@/lib/awarenessSignals";
import { createIncidentResponseIfNeeded } from "@/lib/incidentResponse";
import { calculatePriorityScore, inferExposure } from "@/lib/prioritization";
import { normalizeFindings } from "@/scanner/analyzer";
import { runScanForTarget } from "@/scanner";
import type { DecisionInput, DecisionOutput, DecisionResult } from "@/types/policy";
import type { InngestEventMap } from "@/types";
import { inngest } from "../client";

type ScanRequestedEvent = InngestEventMap["securewatch/scan.requested"];

type ScanTargetRow = {
  id: string;
  tenant_id: string;
  target_name: string;
  target_type: string;
  target_value: string;
  status: "active" | "paused" | "archived";
  owner_email: string | null;
  business_criticality: "low" | "medium" | "high" | "critical" | null;
};

type FindingSeverity = "info" | "low" | "medium" | "high" | "critical";
type InsertedFindingRow = {
  id: string;
  severity: FindingSeverity;
  category: string | null;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  status: string;
};
type EvaluatedFindingRow = {
  findingId: string;
  severity: FindingSeverity;
  category: string | null;
  title: string;
  decisionInput: DecisionInput;
  decisionOutput: DecisionOutput;
  policyDecisionId: string;
  shouldCreateRemediation: boolean;
  shouldCreateApproval: boolean;
  shouldGenerateEvidence: boolean;
};
type RemediationCandidateRow = {
  findingId: string;
  severity: FindingSeverity;
  category: string | null;
  title: string;
  decisionInput: DecisionInput;
  decisionOutput: DecisionOutput;
  policyDecisionId: string;
  approvalStatus: "pending" | "not_required";
  exceptionStatus: "none" | "requested";
};
type RoutedRemediationRow = {
  findingId: string;
  remediationActionId: string;
  approvalStatus: "pending" | "not_required";
  severity: FindingSeverity;
  category: string | null;
  title: string;
  targetType: string;
  targetValue: string;
  decisionInput: DecisionInput;
  decisionOutput: DecisionOutput;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown workflow failure";
}

function mapDecisionResult(decision: DecisionOutput): DecisionResult {
  if (decision.action === "block") return "deny";
  if (decision.requiresApproval) return "require_approval";
  if (decision.action === "request_risk_acceptance") return "defer";
  return "allow";
}

function shouldCreateRemediationAction(decision: DecisionOutput): boolean {
  return (
    decision.action === "create_remediation" ||
    decision.action === "auto_remediate" ||
    decision.action === "escalate" ||
    decision.action === "request_risk_acceptance"
  );
}

function shouldGenerateDecisionEvidence(decision: DecisionOutput): boolean {
  return decision.action !== "monitor_only" && decision.action !== "allow";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * SecureWatch360 v4 scan workflow:
 * - creates a run record
 * - loads a target
 * - executes scanner adapter logic via generic entrypoint
 * - post-scan pipeline:
 *   1) normalize findings
 *   2) store findings
 *   3) assign priority
 *   4) evaluate decisions (approval-aware)
 *   5) create remediation + approval requests
 *   6) generate evidence
 * - marks run completed/failed
 */
export const scanTenantRequested = inngest.createFunction(
  { id: "securewatch-scan-requested", name: "SecureWatch: run requested scan" },
  { event: "securewatch/scan.requested" as const },
  async ({ event, step, runId }) => {
    const payload: ScanRequestedEvent = event.data;
    const supabase = getSupabaseAdminClient();
    let scanRunId: string | null = null;
    let currentStep = "init";

    try {
      currentStep = "create-run-record";
      const createdRun = await step.run("create-run-record", async () => {
        console.info("[scan-workflow] creating run record", {
          workflowRunId: runId,
          tenantId: payload.tenantId,
          scanTargetId: payload.scanTargetId,
        });

        const { data, error } = await supabase
          .from("scan_runs")
          .insert({
            tenant_id: payload.tenantId,
            scan_target_id: payload.scanTargetId,
            workflow_run_id: runId,
            status: SCAN_RUN_STATUSES[0], // queued
          })
          .select("id")
          .single();

        if (error) throw new Error(`Could not create scan run: ${error.message}`);
        return data;
      });

      scanRunId = createdRun.id;

      currentStep = "load-target";
      const target = await step.run("load-target", async (): Promise<ScanTargetRow> => {
        const { data, error } = await supabase
          .from("scan_targets")
          .select("id, tenant_id, target_name, target_type, target_value, status, owner_email, business_criticality")
          .eq("id", payload.scanTargetId)
          .eq("tenant_id", payload.tenantId)
          .single();

        if (error || !data) {
          throw new Error(`Scan target not found for tenant: ${payload.scanTargetId}`);
        }

        if (data.status !== "active") {
          throw new Error(`Scan target is not active (status=${data.status})`);
        }

        return data;
      });

      currentStep = "mark-run-running";
      await step.run("mark-run-running", async () => {
        const { error } = await supabase
          .from("scan_runs")
          .update({
            status: SCAN_RUN_STATUSES[1], // running
            started_at: new Date().toISOString(),
            target_snapshot: {
              id: target.id,
              targetName: target.target_name,
              targetType: target.target_type,
              targetValue: target.target_value,
              ownerEmail: target.owner_email,
              businessCriticality: target.business_criticality,
            },
          })
          .eq("id", scanRunId as string);

        if (error) throw new Error(`Could not mark scan run running: ${error.message}`);
      });

      currentStep = "execute-scanner";
      const scanResult = await step.run("execute-scanner", async () => {
        console.info("[scan-workflow] executing scanner", {
          scanRunId,
          tenantId: payload.tenantId,
          targetType: target.target_type,
          targetValue: target.target_value,
        });

        return runScanForTarget({
          tenantId: payload.tenantId,
          scanTargetId: target.id,
          targetType: target.target_type,
          targetValue: target.target_value,
        });
      });

      currentStep = "normalize-findings";
      const normalizedFindings = await step.run("normalize-findings", async () => {
        const exposure = inferExposure(target.target_type, target.target_value);
        return normalizeFindings({
          tenantId: payload.tenantId,
          scanRunId: scanRunId as string,
          source: scanResult.scanner,
          assetType: target.target_type,
          exposure,
          rawFindings: scanResult.findings,
        });
      });

      currentStep = "insert-findings";
      const insertedFindings = await step.run("insert-findings", async () => {
        if (normalizedFindings.length === 0) {
          return [] as InsertedFindingRow[];
        }

        const { data, error } = await supabase
          .from("findings")
          .insert(normalizedFindings)
          .select("id, severity, category, title, description, evidence, status");

        if (error) throw new Error(`Could not insert findings: ${error.message}`);
        return (data ?? []) as InsertedFindingRow[];
      });

      const insertedCount = insertedFindings.length;

      currentStep = "catalog-cves";
      const cveSummary = await step.run("catalog-cves", async () => {
        const linkedCves = await recordCvesForFindings(
          insertedFindings.map((finding) => ({
            id: finding.id,
            tenantId: payload.tenantId,
            title: finding.title,
            description: finding.description,
            evidence: finding.evidence,
            scannerSource: scanResult.scanner,
          }))
        );
        return { linkedCves };
      });

      currentStep = "assign-priority";
      const prioritySummary = await step.run("assign-priority", async () => {
        if (insertedFindings.length === 0) {
          return {
            prioritizedCount: 0,
            highestPriorityScore: 0,
          };
        }

        const exposure = inferExposure(target.target_type, target.target_value);
        let prioritizedCount = 0;
        let highestPriorityScore = 0;

        for (const finding of insertedFindings) {
          const score = calculatePriorityScore({
            severity: finding.severity,
            assetType: target.target_type,
            exposure,
          });
          highestPriorityScore = Math.max(highestPriorityScore, score);

          const { error } = await supabase
            .from("findings")
            .update({
              asset_type: target.target_type,
              exposure,
              priority_score: score,
              updated_at: new Date().toISOString(),
            })
            .eq("id", finding.id);

          if (error) {
            throw new Error(`Could not assign priority for finding ${finding.id}: ${error.message}`);
          }
          prioritizedCount += 1;
        }

        return {
          prioritizedCount,
          highestPriorityScore,
        };
      });

      currentStep = "evaluate-findings";
      const evaluatedFindings = await step.run("evaluate-findings", async () => {
        if (insertedFindings.length === 0) {
          return [] as EvaluatedFindingRow[];
        }

        const exposure = inferExposure(target.target_type, target.target_value);
        const evaluated: EvaluatedFindingRow[] = [];

        for (const finding of insertedFindings) {
          const decisionInput: DecisionInput = {
            tenantId: payload.tenantId,
            findingId: finding.id,
            severity: finding.severity,
            category: finding.category,
            assetType: target.target_type,
            ownerEmail: target.owner_email,
            businessCriticality: target.business_criticality,
            targetType: target.target_type,
            exposure,
            scannerName: scanResult.scannerName,
            currentFindingStatus:
              finding.status === "open" ||
              finding.status === "acknowledged" ||
              finding.status === "in_progress" ||
              finding.status === "resolved" ||
              finding.status === "risk_accepted"
                ? finding.status
                : "open",
          };
          const decisionOutput = await evaluateDecision(decisionInput);
          const policyDecisionResult = mapDecisionResult(decisionOutput);
          const reason = decisionOutput.reasonCodes.join(", ");
          const rawPolicyId = decisionOutput.matchedPolicies[0]?.policyId ?? null;
          // Rules provider can emit logical IDs (for example sw360.rule.*) that are not DB UUIDs.
          // Persist only UUID policy IDs to preserve FK/type integrity.
          const primaryPolicyId =
            typeof rawPolicyId === "string" && isUuid(rawPolicyId) ? rawPolicyId : null;

          const { data: policyDecision, error: policyDecisionError } = await supabase
            .from("policy_decisions")
            .insert({
              tenant_id: payload.tenantId,
              finding_id: finding.id,
              remediation_action_id: null,
              policy_id: primaryPolicyId,
              decision_type: "finding_triage",
              decision_result: policyDecisionResult,
              reason: reason || null,
              input_payload: decisionInput,
              output_payload: decisionOutput,
            })
            .select("id")
            .single();

          if (policyDecisionError || !policyDecision) {
            throw new Error(
              `Could not persist policy decision for finding ${finding.id}: ${policyDecisionError?.message ?? "unknown error"}`
            );
          }

          const { error } = await supabase
            .from("findings")
            .update({
              decision_input: decisionInput,
              decision_result: decisionOutput,
              approval_status: decisionOutput.requiresApproval ? "pending" : "not_required",
              exception_status:
                decisionOutput.action === "request_risk_acceptance" ? "requested" : "none",
              updated_at: new Date().toISOString(),
            })
            .eq("id", finding.id);

          if (error) {
            throw new Error(`Could not persist decision output for finding ${finding.id}: ${error.message}`);
          }

          await writeAuditLog({
            userId: null,
            tenantId: payload.tenantId,
            entityType: "policy_decision",
            entityId: `${runId}:${finding.id}`,
            action: "policy.decision.evaluated",
            summary: `Policy decision evaluated for finding ${finding.id}`,
            payload: {
              scanRunId,
              workflowRunId: runId,
              findingId: finding.id,
              policyDecisionId: policyDecision.id,
              policyDecisionResult,
              decisionAction: decisionOutput.action,
              requiresApproval: decisionOutput.requiresApproval,
              autoRemediationAllowed: decisionOutput.autoRemediationAllowed,
              reasonCodes: decisionOutput.reasonCodes,
              matchedPolicies: decisionOutput.matchedPolicies,
            },
          });

          evaluated.push({
            findingId: finding.id,
            severity: finding.severity,
            category: finding.category,
            title: finding.title,
            decisionInput,
            decisionOutput,
            policyDecisionId: policyDecision.id,
            shouldCreateRemediation: shouldCreateRemediationAction(decisionOutput),
            shouldCreateApproval: decisionOutput.requiresApproval,
            shouldGenerateEvidence: shouldGenerateDecisionEvidence(decisionOutput),
          });
        }

        return evaluated;
      });

      currentStep = "run-compliance-agent-hooks";
      const complianceSummary = await step.run("run-compliance-agent-hooks", async () => {
        if (evaluatedFindings.length === 0) {
          return {
            hooksProcessed: 0,
            impactedFindings: 0,
            controlsMapped: 0,
            evidenceRecordsCreated: 0,
            hookFailures: 0,
          };
        }

        let hooksProcessed = 0;
        let impactedFindings = 0;
        let controlsMapped = 0;
        let evidenceRecordsCreated = 0;
        let hookFailures = 0;

        for (const finding of evaluatedFindings) {
          try {
            const result = await runComplianceAgentHook({
              tenantId: payload.tenantId,
              scanRunId: scanRunId as string,
              workflowRunId: runId,
              findingId: finding.findingId,
              findingCategory: finding.category,
              findingTitle: finding.title,
              severity: finding.severity,
              decisionOutput: finding.decisionOutput,
              policyDecisionId: finding.policyDecisionId,
            });

            hooksProcessed += 1;
            controlsMapped += result.mappedControlsCount;
            evidenceRecordsCreated += result.evidenceRecordsCreated;
            if (result.complianceImpact !== "none") {
              impactedFindings += 1;
            }
          } catch (error) {
            hookFailures += 1;
            console.error("[scan-workflow] compliance hook failed", {
              scanRunId,
              workflowRunId: runId,
              findingId: finding.findingId,
              error: getErrorMessage(error),
            });
          }
        }

        return {
          hooksProcessed,
          impactedFindings,
          controlsMapped,
          evidenceRecordsCreated,
          hookFailures,
        };
      });

      currentStep = "prepare-remediation-candidates";
      const remediationCandidates = await step.run("prepare-remediation-candidates", async () => {
        const candidates: RemediationCandidateRow[] = [];
        let monitorOnlyFindings = 0;
        let evidenceCandidateFindings = 0;

        for (const item of evaluatedFindings) {
          if (item.shouldGenerateEvidence) {
            evidenceCandidateFindings += 1;
          }

          if (!item.shouldCreateRemediation) {
            monitorOnlyFindings += 1;
            continue;
          }

          candidates.push({
            findingId: item.findingId,
            severity: item.severity,
            category: item.category,
            title: item.title,
            decisionInput: item.decisionInput,
            decisionOutput: item.decisionOutput,
            policyDecisionId: item.policyDecisionId,
            approvalStatus: item.shouldCreateApproval ? "pending" : "not_required",
            exceptionStatus:
              item.decisionOutput.action === "request_risk_acceptance" ? "requested" : "none",
          });
        }

        return {
          candidates,
          monitorOnlyFindings,
          evidenceCandidateFindings,
        };
      });

      currentStep = "route-remediation-candidates";
      const routedRemediations = await step.run("route-remediation-candidates", async () => {
        const routed: RoutedRemediationRow[] = [];
        let created = 0;
        let updated = 0;
        let autoReadyActions = 0;
        let manualActions = 0;

        for (const candidate of remediationCandidates.candidates) {
          const result = await routeRemediationCandidate({
            tenantId: payload.tenantId,
            findingId: candidate.findingId,
            scanRunId: scanRunId as string,
            workflowRunId: runId,
            policyDecisionId: candidate.policyDecisionId,
            decisionInput: candidate.decisionInput,
            decisionOutput: candidate.decisionOutput,
            severity: candidate.severity,
            category: candidate.category,
            title: candidate.title,
            targetType: target.target_type,
            targetValue: target.target_value,
            exposure: inferExposure(target.target_type, target.target_value),
            requiresApproval: candidate.approvalStatus === "pending",
            approvalStatus: candidate.approvalStatus,
            exceptionStatus: candidate.exceptionStatus,
          });

          if (result.operation === "created") {
            created += 1;
          } else {
            updated += 1;
          }

          if (result.executionMode === "automatic") {
            autoReadyActions += 1;
          } else {
            manualActions += 1;
          }

          routed.push({
            findingId: candidate.findingId,
            remediationActionId: result.remediationActionId,
            approvalStatus: candidate.approvalStatus,
            severity: candidate.severity,
            category: candidate.category,
            title: candidate.title,
            targetType: target.target_type,
            targetValue: target.target_value,
            decisionInput: candidate.decisionInput,
            decisionOutput: candidate.decisionOutput,
          });
        }

        return {
          routed,
          created,
          updated,
          autoReadyActions,
          manualActions,
        };
      });

      currentStep = "create-incident-response-records";
      const incidentResponseSummary = await step.run("create-incident-response-records", async () => {
        let incidentResponsesCreated = 0;
        let lifecycleEventsEmitted = 0;

        for (const item of routedRemediations.routed) {
          const incident = await createIncidentResponseIfNeeded({
            tenantId: payload.tenantId,
            scanRunId: scanRunId as string,
            workflowRunId: runId,
            finding: {
              id: item.findingId,
              severity: item.severity,
              category: item.category,
              title: item.title,
              targetType: item.targetType,
              targetValue: item.targetValue,
            },
            decisionOutput: item.decisionOutput,
            remediationActionId: item.remediationActionId,
            requiresHumanApproval: item.approvalStatus === "pending",
          });

          if (!incident.created) continue;
          incidentResponsesCreated += 1;
          lifecycleEventsEmitted += item.approvalStatus === "pending" ? 10 : 9;
        }

        return {
          incidentResponsesCreated,
          lifecycleEventsEmitted,
        };
      });

      currentStep = "create-approval-requests";
      const approvalSummary = await step.run("create-approval-requests", async () => {
        let approvalRequestsCreated = 0;
        let pendingApprovalActions = 0;

        for (const item of routedRemediations.routed) {
          if (item.approvalStatus !== "pending") continue;

          pendingApprovalActions += 1;
          const { error: approvalError } = await supabase.from("approval_requests").insert({
            tenant_id: payload.tenantId,
            finding_id: item.findingId,
            remediation_action_id: item.remediationActionId,
            requested_by_user_id: null,
            assigned_approver_user_id: null,
            approval_type: "remediation_execution",
            status: "pending",
            reason: `Decision engine requires approval before execution. action=${item.decisionOutput.action}`,
            request_payload: {
              decisionInput: item.decisionInput,
              decisionOutput: item.decisionOutput,
            },
            response_payload: {},
            updated_at: new Date().toISOString(),
          });

          if (approvalError) {
            throw new Error(
              `Could not create approval request for remediation ${item.remediationActionId}: ${approvalError.message}`
            );
          }

          approvalRequestsCreated += 1;
        }

        return {
          approvalRequestsCreated,
          pendingApprovalActions,
        };
      });

      const remediationSummary = {
        actionsCreated: routedRemediations.created,
        actionsUpdated: routedRemediations.updated,
        approvalRequestsCreated: approvalSummary.approvalRequestsCreated,
        autoReadyActions: routedRemediations.autoReadyActions,
        manualActions: routedRemediations.manualActions,
        pendingApprovalActions: approvalSummary.pendingApprovalActions,
        monitorOnlyFindings: remediationCandidates.monitorOnlyFindings,
        policyDecisionsCreated: evaluatedFindings.length,
        evidenceCandidateFindings: remediationCandidates.evidenceCandidateFindings,
        evaluatedFindings: evaluatedFindings.length,
        incidentResponsesCreated: incidentResponseSummary.incidentResponsesCreated,
        incidentLifecycleEventsEmitted: incidentResponseSummary.lifecycleEventsEmitted,
      };

      currentStep = "derive-awareness-training";
      const awarenessTrainingPlan = await step.run("derive-awareness-training", async () => {
        const signals = await getLatestAwarenessSignals(payload.tenantId).catch(() => ({
          realWorldSignals: [] as string[],
          companySignals: [] as string[],
        }));
        return buildAwarenessTrainingPlan({
          tenantId: payload.tenantId,
          findings: evaluatedFindings.map((item) => ({
            severity: item.severity,
            category: item.category,
            title: item.title,
          })),
          realWorldSignals: signals.realWorldSignals,
          companySignals: signals.companySignals,
        });
      });

      currentStep = "generate-evidence-records";
      const evidenceRecordsCreated = await step.run("generate-evidence-records", async () => {
        try {
          const evidenceFindings = evaluatedFindings
            .filter((item) => item.shouldGenerateEvidence)
            .map((item) => ({
              id: item.findingId,
              severity: item.severity,
            }));

          return await createScanCompletionEvidence({
            tenantId: payload.tenantId,
            scanRunId: scanRunId as string,
            workflowRunId: runId,
            findings: evidenceFindings,
            scannerName: scanResult.scannerName,
            scannerType: scanResult.scannerType,
            targetType: target.target_type,
            targetValue: target.target_value,
          });
        } catch (error) {
          const message = getErrorMessage(error);
          console.error("[scan-workflow] evidence generation failed", {
            scanRunId,
            workflowRunId: runId,
            error: message,
          });
          return 0;
        }
      });

      currentStep = "complete-run";
      await step.run("complete-run", async () => {
        const resultSummary = {
          findingsDetected: scanResult.findings.length,
          findingsInserted: insertedCount,
          linkedCves: cveSummary.linkedCves,
          prioritizedFindings: prioritySummary.prioritizedCount,
          highestPriorityScore: prioritySummary.highestPriorityScore,
          evidenceRecordsCreated,
          remediationActionsCreated: remediationSummary.actionsCreated,
          remediationActionsUpdated: remediationSummary.actionsUpdated,
          approvalRequestsCreated: remediationSummary.approvalRequestsCreated,
          complianceHooksProcessed: complianceSummary.hooksProcessed,
          complianceImpactedFindings: complianceSummary.impactedFindings,
          complianceControlsMapped: complianceSummary.controlsMapped,
          complianceEvidenceRecordsCreated: complianceSummary.evidenceRecordsCreated,
          complianceHookFailures: complianceSummary.hookFailures,
          autoReadyRemediationActions: remediationSummary.autoReadyActions,
          manualRemediationActions: remediationSummary.manualActions,
          pendingApprovalRemediationActions: remediationSummary.pendingApprovalActions,
          monitorOnlyFindings: remediationSummary.monitorOnlyFindings,
          policyDecisionsCreated: remediationSummary.policyDecisionsCreated,
          evidenceCandidateFindings: remediationSummary.evidenceCandidateFindings,
          evaluatedFindings: remediationSummary.evaluatedFindings,
          incidentResponsesCreated: remediationSummary.incidentResponsesCreated,
          incidentLifecycleEventsEmitted: remediationSummary.incidentLifecycleEventsEmitted,
          awarenessTrainingPlan,
          severityCounts: normalizedFindings.reduce<Record<string, number>>((acc, item) => {
            acc[item.severity] = (acc[item.severity] ?? 0) + 1;
            return acc;
          }, {}),
          targetType: target.target_type,
          targetValue: target.target_value,
        };

        const { error } = await supabase
          .from("scan_runs")
          .update({
            status: SCAN_RUN_STATUSES[2], // completed
            completed_at: new Date().toISOString(),
            error_message: null,
            scanner_name: scanResult.scannerName,
            scanner_type: scanResult.scannerType,
            result_summary: resultSummary,
          })
          .eq("id", scanRunId as string);

        if (error) throw new Error(`Could not finalize scan run: ${error.message}`);
      });

      console.info("[scan-workflow] completed", {
        scanRunId,
        workflowRunId: runId,
        scannerName: scanResult.scannerName,
        scannerType: scanResult.scannerType,
        findingsInserted: insertedCount,
        linkedCves: cveSummary.linkedCves,
        prioritizedFindings: prioritySummary.prioritizedCount,
        remediationActionsCreated: remediationSummary.actionsCreated,
        remediationActionsUpdated: remediationSummary.actionsUpdated,
        approvalRequestsCreated: remediationSummary.approvalRequestsCreated,
        complianceHooksProcessed: complianceSummary.hooksProcessed,
        complianceImpactedFindings: complianceSummary.impactedFindings,
        complianceControlsMapped: complianceSummary.controlsMapped,
        complianceEvidenceRecordsCreated: complianceSummary.evidenceRecordsCreated,
        complianceHookFailures: complianceSummary.hookFailures,
        autoReadyRemediationActions: remediationSummary.autoReadyActions,
        manualRemediationActions: remediationSummary.manualActions,
        pendingApprovalRemediationActions: remediationSummary.pendingApprovalActions,
        monitorOnlyFindings: remediationSummary.monitorOnlyFindings,
        policyDecisionsCreated: remediationSummary.policyDecisionsCreated,
        evidenceCandidateFindings: remediationSummary.evidenceCandidateFindings,
        incidentResponsesCreated: remediationSummary.incidentResponsesCreated,
        incidentLifecycleEventsEmitted: remediationSummary.incidentLifecycleEventsEmitted,
        evidenceRecordsCreated,
      });

      return {
        ok: true,
        workflowRunId: runId,
        scanRunId,
        tenantId: payload.tenantId,
        scanTargetId: target.id,
        targetName: target.target_name,
        targetValue: target.target_value,
        findingsInserted: insertedCount,
        prioritizedFindings: prioritySummary.prioritizedCount,
        highestPriorityScore: prioritySummary.highestPriorityScore,
        evidenceRecordsCreated,
        remediationActionsCreated: remediationSummary.actionsCreated,
        remediationActionsUpdated: remediationSummary.actionsUpdated,
        approvalRequestsCreated: remediationSummary.approvalRequestsCreated,
        complianceHooksProcessed: complianceSummary.hooksProcessed,
        complianceImpactedFindings: complianceSummary.impactedFindings,
        complianceControlsMapped: complianceSummary.controlsMapped,
        complianceEvidenceRecordsCreated: complianceSummary.evidenceRecordsCreated,
        complianceHookFailures: complianceSummary.hookFailures,
        autoReadyRemediationActions: remediationSummary.autoReadyActions,
        manualRemediationActions: remediationSummary.manualActions,
        pendingApprovalRemediationActions: remediationSummary.pendingApprovalActions,
        monitorOnlyFindings: remediationSummary.monitorOnlyFindings,
        policyDecisionsCreated: remediationSummary.policyDecisionsCreated,
        evidenceCandidateFindings: remediationSummary.evidenceCandidateFindings,
        incidentResponsesCreated: remediationSummary.incidentResponsesCreated,
        incidentLifecycleEventsEmitted: remediationSummary.incidentLifecycleEventsEmitted,
        awarenessTrainingPlan,
        scannerName: scanResult.scannerName,
        scannerType: scanResult.scannerType,
      };
    } catch (error) {
      const message = getErrorMessage(error);

      if (scanRunId) {
        try {
          await step.run("fail-run", async () => {
            const { error } = await supabase
              .from("scan_runs")
              .update({
                status: SCAN_RUN_STATUSES[3], // failed
                completed_at: new Date().toISOString(),
                error_message: message,
                result_summary: {
                  failureStep: currentStep,
                  failureMessage: message,
                },
              })
              .eq("id", scanRunId as string);

            if (error) {
              throw new Error(error.message);
            }
          });
        } catch (failRunError) {
          console.error("[scan-workflow] could not persist failed run state", {
            scanRunId,
            workflowRunId: runId,
            currentStep,
            failRunError: getErrorMessage(failRunError),
          });
        }
      }

      console.error("[scan-workflow] failed", {
        scanRunId,
        workflowRunId: runId,
        currentStep,
        error: message,
      });

      throw new Error(`securewatch scan workflow failed: ${message}`);
    }
  }
);
