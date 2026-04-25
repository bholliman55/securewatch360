# SecureWatch360 Agent E2E Testing

This document defines where the "agents" are in v4 (Inngest architecture) and how to test them end-to-end before production.

## Agent inventory in v4

The n8n webhook agents were replaced by code-native modules and Inngest workflows.

- Decisioning Agent (logical): `src/lib/decisionEngine.ts`
- Compliance Agent (hook): `src/lib/complianceAgent.ts`
- Remediation Agent (hook): `src/lib/remediationAgent.ts`
- Scan Workflow Agent (orchestrator): `src/inngest/functions/scan-tenant.ts`
- Monitoring Workflow Agent (orchestrator): `src/inngest/functions/monitoring-alert-received.ts`

Related scheduled orchestrators (non-interactive):

- `src/inngest/functions/scheduled-scans.ts`

## Automated E2E harness

Primary script:

- `scripts/qa-v4-agents-e2e.ts`
- `scripts/qa-v4-hardening.ts` (matrix + repeated production hardening runs)

Run command:

```bash
npm run qa:v4:agents
```

Hardening matrix run:

```bash
npm run qa:v4:hardening
```

Output reports:

- `docs/reports/agent-e2e-latest.md`
- `docs/reports/agent-e2e-<timestamp>.md`
- `docs/reports/agent-e2e-<timestamp>.json`
- `docs/reports/hardening-latest.md`
- `docs/reports/hardening-<timestamp>.md`
- `docs/reports/hardening-<timestamp>.json`

## What is tested

The harness executes these tests in order:

1. Create QA scan target in tenant.
2. Trigger `securewatch/scan.requested`.
3. Wait for scan workflow completion.
4. Verify Decisioning Agent artifacts:
   - findings created
   - `decision_input` and `decision_result` populated
   - `policy_decisions` rows cover all findings
5. Verify Compliance Agent artifacts:
   - `compliance_impact` on findings
   - control mappings and evidence record counts
6. Verify Remediation Agent artifacts:
   - `remediation_actions` created when applicable
   - execution and payload fields present
7. Verify Approval workflow artifacts:
   - `approval_requests` when approval path is taken
8. Verify Monitoring Workflow Agent:
   - trigger `securewatch/monitoring.alert.received`
   - run completes and creates monitoring finding

## Required runtime data/config

Required env vars:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INNGEST_EVENT_KEY`
- `TEST_TENANT_ID`

Optional tuning:

- `QA_MAX_ATTEMPTS` (default `20`)
- `QA_POLL_INTERVAL_MS` (default `3000`)

## Data prerequisites

Minimum data needed:

- A tenant row matching `TEST_TENANT_ID`.
- Baseline control framework/control requirement rows if you want non-zero control mapping counts from compliance checks.
- Existing Inngest app keys valid for this environment.

Optional helper:

- Run `npm run seed:v4` to seed baseline tenant/policies/targets.

## Iterative production hardening loop

1. Run `npm run qa:v4:agents`.
2. If failure:
   - inspect `docs/reports/agent-e2e-latest.md`
   - fix root cause in code or data
3. Re-run until all tests are passed/skipped intentionally.
4. Save final passing report artifact for release signoff.

## Next-level hardening matrix

`npm run qa:v4:hardening` executes repeated runs across scenarios:

- `rules-baseline`: deterministic rules provider
- `opa-failopen`: OPA provider with unreachable endpoint; validates fail-open safety
- `opa-configured-endpoint`: runs only when `OPA_POLICY_EVAL_URL` is configured

Tuning env vars:

- `HARDENING_ITERATIONS` (default `3`)
- `HARDENING_STALE_RUN_MINUTES` (default `10`)
