# SecureWatch360 Hardening Report

- runId: `qa-v4-hardening-2026-04-23T16-56-02-117Z`
- tenantId: `8c2b980c-9fc8-4b71-9b5f-2e90a5c3a001`
- iterationsPerScenario: `3`
- staleRunningThresholdMinutes: `10`
- summary: passed=0, failed=6, total=6

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
- passed: `false`
- durationMs: `24683`
- staleRunningCount: `0`
- error: ENOENT: no such file or directory, open 'C:\Users\brent\source\securewatch360\docs\reports\agent-e2e-latest.json'

### rules-baseline / iteration 2
- passed: `false`
- durationMs: `17907`
- staleRunningCount: `0`
- error: ENOENT: no such file or directory, open 'C:\Users\brent\source\securewatch360\docs\reports\agent-e2e-latest.json'

### rules-baseline / iteration 3
- passed: `false`
- durationMs: `18844`
- staleRunningCount: `0`
- error: ENOENT: no such file or directory, open 'C:\Users\brent\source\securewatch360\docs\reports\agent-e2e-latest.json'

### opa-failopen / iteration 1
- passed: `false`
- durationMs: `19593`
- staleRunningCount: `0`
- error: ENOENT: no such file or directory, open 'C:\Users\brent\source\securewatch360\docs\reports\agent-e2e-latest.json'

### opa-failopen / iteration 2
- passed: `false`
- durationMs: `19476`
- staleRunningCount: `0`
- error: ENOENT: no such file or directory, open 'C:\Users\brent\source\securewatch360\docs\reports\agent-e2e-latest.json'

### opa-failopen / iteration 3
- passed: `false`
- durationMs: `19318`
- staleRunningCount: `0`
- error: ENOENT: no such file or directory, open 'C:\Users\brent\source\securewatch360\docs\reports\agent-e2e-latest.json'

## Notes

- This hardening run executes the full agent E2E suite repeatedly under provider matrix scenarios.
- `opa-failopen` validates bootstrap safety: OPA outage should not break decisioning pipeline.
- Stale running scans metric detects workflow hangs older than threshold.
