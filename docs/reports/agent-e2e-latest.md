# SecureWatch360 Agent E2E Report

- runId: `qa-v4-agents-2026-04-23T17-00-13-758Z`
- tenantId: `8c2b980c-9fc8-4b71-9b5f-2e90a5c3a001`
- summary: passed=8, failed=0, skipped=0, total=8

## Tests Executed

### T00 - Preflight environment validation
- status: `passed`
- durationMs: `0`
- detail: Environment values required for E2E execution are present.
- detail: tenantId source=TEST_TENANT_ID
- detail: inngest event key source=default-dev-placeholder
- detail: tenantId=8c2b980c-9fc8-4b71-9b5f-2e90a5c3a001
- detail: maxAttempts=20
- detail: pollIntervalMs=3000

### T01 - Create QA scan target
- status: `passed`
- durationMs: `215`
- detail: scanTargetId=776d1d95-d906-4b6f-aca7-9cbd26fd7ef5
- detail: targetName=qa-v4-agents-target-2026-04-23T17-00-13-783Z

### T02 - Trigger scan workflow and wait for completion
- status: `passed`
- durationMs: `6316`
- detail: scanRunId=059723de-8d52-407b-8893-f26b50c78fd3
- detail: status=completed
- detail: scanner_type=mock

### T03 - Validate decisioning agent artifacts
- status: `passed`
- durationMs: `194`
- detail: findings=2
- detail: policyDecisions=2
- detail: coverage=2/2

### T04 - Validate compliance agent artifacts
- status: `passed`
- durationMs: `289`
- detail: findingsWithComplianceImpact=2
- detail: findingsWithComplianceContext=2
- detail: controlMappings=2
- detail: evidenceRecords=3

### T05 - Validate remediation agent artifacts
- status: `passed`
- durationMs: `95`
- detail: remediationActions=1
- detail: executionFieldsValidated=1
- detail: actionTypes=manual_fix

### T06 - Validate approval workflow artifacts
- status: `passed`
- durationMs: `1174`
- detail: No natural approval rows found; executed forced approval-path branch.
- detail: approvalRequests=1
- detail: statuses=pending

### T07 - Validate monitoring workflow agent
- status: `passed`
- durationMs: `3292`
- detail: monitoringRunId=1069b553-6730-44ae-b5df-69ef49d9607f
- detail: monitoringFindings=1

## Agent Coverage

- Decisioning Agent: `evaluateDecision()` + `policy_decisions` assertions
- Compliance Agent: `runComplianceAgentHook()` outputs on findings/mappings/evidence
- Remediation Agent: `routeRemediationCandidate()` output fields on `remediation_actions`
- Approval Workflow Agent: `approval_requests` generation checks
- Monitoring Workflow Agent: `securewatch/monitoring.alert.received` run + finding
