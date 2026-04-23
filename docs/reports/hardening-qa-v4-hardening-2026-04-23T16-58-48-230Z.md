# SecureWatch360 Hardening Report

- runId: `qa-v4-hardening-2026-04-23T16-58-48-230Z`
- tenantId: `8c2b980c-9fc8-4b71-9b5f-2e90a5c3a001`
- iterationsPerScenario: `3`
- staleRunningThresholdMinutes: `10`
- summary: passed=6, failed=0, total=6

## Scenario Matrix

### rules-baseline - Rules Provider Baseline
- enabled: `true`
- description: Verifies stable operation with deterministic rules provider.

### opa-failopen - OPA Provider Fail-Open
- enabled: `true`
- description: Forces OPA provider with an unreachable endpoint and validates fail-open fallback to rules.

### opa-configured-endpoint - OPA Provider Configured Endpoint
- enabled: `false`
- description: Uses configured OPA endpoint if provided in environment.
- skipReason: OPA_POLICY_EVAL_URL not configured in environment

## Iteration Results

### rules-baseline / iteration 1
- passed: `true`
- durationMs: `16521`
- staleRunningCount: `0`
- agentReportRunId: `qa-v4-agents-2026-04-23T16-58-52-215Z`

### rules-baseline / iteration 2
- passed: `true`
- durationMs: `17050`
- staleRunningCount: `0`
- agentReportRunId: `qa-v4-agents-2026-04-23T16-59-09-748Z`

### rules-baseline / iteration 3
- passed: `true`
- durationMs: `15836`
- staleRunningCount: `0`
- agentReportRunId: `qa-v4-agents-2026-04-23T16-59-25-904Z`

### opa-failopen / iteration 1
- passed: `true`
- durationMs: `16072`
- staleRunningCount: `0`
- agentReportRunId: `qa-v4-agents-2026-04-23T16-59-41-766Z`

### opa-failopen / iteration 2
- passed: `true`
- durationMs: `16103`
- staleRunningCount: `0`
- agentReportRunId: `qa-v4-agents-2026-04-23T16-59-57-765Z`

### opa-failopen / iteration 3
- passed: `true`
- durationMs: `15733`
- staleRunningCount: `0`
- agentReportRunId: `qa-v4-agents-2026-04-23T17-00-13-758Z`

## Notes

- This hardening run executes the full agent E2E suite repeatedly under provider matrix scenarios.
- `opa-failopen` validates bootstrap safety: OPA outage should not break decisioning pipeline.
- Stale running scans metric detects workflow hangs older than threshold.
