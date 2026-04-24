# v1.1 Phased Delivery Plan

This plan is execution-oriented: each phase ends with implementation, real-data verification, and source control handoff.

## Phase A - Connector reliability and ingestion (current)

Scope:

- Add retry/backoff to scanner connectors.
- Add dedupe by external finding ID.
- Add Tenable alert ingestion endpoint with event dedupe.
- Add real-data QA script for Tenable and Semgrep connectors.

Done criteria:

- `src/scanner/reliability.ts` is used by Tenable and Semgrep connectors.
- `/api/integrations/tenable/alerts` accepts authenticated ingest events and prevents duplicate ingestion by `eventId`.
- `npm run qa:v1:connectors:real` runs against configured live tenants/repos.

## Phase B - Runtime integration hardening

Scope:

- Add structured connector telemetry and failure counters.
- Add connector dead-letter capture for persistent API failures.
- Add pagination and contract validation for all normalized finding fields.
- Add scanner-specific dedupe keys (`scanner + externalId + target`) and stale-window suppression.

Done criteria:

- Failures can be triaged from logs/metrics without reproducing locally.
- Replayed events do not create duplicate findings in normal operation.
- Integration tests cover failure, retry, and partial-page scenarios.

## Phase C - Execution and monitoring maturity

Scope:

- Add webhook/API adapters for additional monitoring sources.
- Add automated incident enrichment and cross-source correlation.
- Add remediation adapter hardening for ticketing/cloud/ansible execution.
- Add phase-level operational runbooks and dashboards.

Done criteria:

- Continuous monitoring feeds create actionable incidents with minimal manual triage.
- Remediation execution has observable success/failure lifecycle and rollback guidance.
- Ops runbook enables on-call teams to manage failures quickly.
