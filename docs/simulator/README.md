# Simulator documentation artifacts

Stable copies of simulator outputs live here so reviewers can skim a report without running the lab.

## Fastest demo run

```bash
npm run demo:stack
```

The command runs three curated scenarios and auto-generates reports for a complete demo narrative:

- vulnerability discovery with remediation workflow
- incident containment/isolation workflow
- compliance drift correction workflow

Defaults:

- `SIMULATION_MODE=local`
- `SIMULATION_DEMO_MODE=true`

Artifacts are written to `.simulation-results/` and `simulator/reports/output/`.

## Staging proof run

```bash
npm run demo:stack:staging -- --dry-run
npm run demo:stack:staging
```

`demo:stack:staging` validates required Supabase/Inngest env upfront, runs the curated demo scenarios, regenerates human reports, and writes a staging validation summary to:

- `docs/reports/demo-stack-staging-latest.md`
- `docs/reports/demo-stack-staging-<timestamp>.md`

## Staging rehearsals

- [`STAGING-RUNBOOK.md`](./STAGING-RUNBOOK.md) — **`SIMULATION_MODE=supabase` / `inngest`**, tenant id, verification, and correlation behavior.

## Sample human-readable report

- [`sample-golden-phishing-training-monitoring-report.md`](./sample-golden-phishing-training-monitoring-report.md) — Markdown matching a **`SIMULATION_MODE=local`** rehearsal of [`golden-phishing-training-monitoring`](../../simulator/scenarios/golden-path/golden-phishing-training-monitoring.json); regenerate any time via `npm run sim:report -- --runId <uuid>` after a run.

In **local** mode many scenarios **FAIL** expectation correlation (no audited workflow side effects). Use staging mode (`STAGING-RUNBOOK.md`) when validating orchestration fidelity.
