# Simulator documentation artifacts

Stable copies of simulator outputs live here so reviewers can skim a report without running the lab.

## Staging rehearsals

- [`STAGING-RUNBOOK.md`](./STAGING-RUNBOOK.md) — **`SIMULATION_MODE=supabase` / `inngest`**, tenant id, verification, and correlation behavior.

## Sample human-readable report

- [`sample-golden-phishing-training-monitoring-report.md`](./sample-golden-phishing-training-monitoring-report.md) — Markdown matching a **`SIMULATION_MODE=local`** rehearsal of [`golden-phishing-training-monitoring`](../../simulator/scenarios/golden-path/golden-phishing-training-monitoring.json); regenerate any time via `npm run sim:report -- --runId <uuid>` after a run.

In **local** mode many scenarios **FAIL** expectation correlation (no audited workflow side effects). Use staging mode (`STAGING-RUNBOOK.md`) when validating orchestration fidelity.
