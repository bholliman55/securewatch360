# SecureWatch360 Agent E2E Report

- runId: `qa-v4-agents-2026-04-27T04-31-17-688Z`
- tenantId: `8c2b980c-9fc8-4b71-9b5f-2e90a5c3a001`
- summary: passed=8, failed=0, skipped=0, total=8

## Tests Executed

### T00 - Preflight environment validation
- status: `passed`
- durationMs: `3`
- detail: Environment values required for E2E execution are present.
- detail: tenantId source=TEST_TENANT_ID
- detail: inngest event key source=env
- detail: tenantId=8c2b980c-9fc8-4b71-9b5f-2e90a5c3a001
- detail: maxAttempts=30
- detail: pollIntervalMs=3000

### T01 - Create QA scan target
- status: `passed`
- durationMs: `1070`
- detail: scanTargetId=faaf23af-8c54-4954-a610-dd3f20ff55ac
- detail: targetName=qa-v4-agents-target-2026-04-27T04-31-18-115Z

### T02 - Trigger scan workflow and wait for completion
- status: `passed`
- durationMs: `69705`
- detail: scanRunId=784dcab3-b3dd-4137-8616-2a77e0cc4dfd
- detail: status=completed
- detail: scanner_type=mock

### T03 - Validate decisioning agent artifacts
- status: `passed`
- durationMs: `577`
- detail: findings=2
- detail: policyDecisions=2
- detail: coverage=2/2

### T04 - Validate compliance agent artifacts
- status: `passed`
- durationMs: `507`
- detail: findingsWithComplianceImpact=2
- detail: findingsWithComplianceContext=2
- detail: controlMappings=2
- detail: evidenceRecords=4

### T05 - Validate remediation agent artifacts
- status: `passed`
- durationMs: `162`
- detail: remediationActions=1
- detail: executionFieldsValidated=1
- detail: actionTypes=manual_fix

### T06 - Validate approval workflow artifacts
- status: `passed`
- durationMs: `3332`
- detail: No natural approval rows found; executed forced approval-path branch.
- detail: approvalRequests=1
- detail: statuses=pending

### T07 - Validate monitoring workflow agent
- status: `passed`
- durationMs: `18917`
- detail: monitoringRunId=5329a394-209e-4fe2-9173-baaa651dd073
- detail: monitoringFindings=1

## Agent Coverage

- Decisioning Agent: `evaluateDecision()` + `policy_decisions` assertions
- Compliance Agent: `runComplianceAgentHook()` outputs on findings/mappings/evidence
- Remediation Agent: `routeRemediationCandidate()` output fields on `remediation_actions`
- Approval Workflow Agent: `approval_requests` generation checks
- Monitoring Workflow Agent: `securewatch/monitoring.alert.received` run + finding
