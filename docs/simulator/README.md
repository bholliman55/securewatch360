# Simulator documentation artifacts

Stable copies of simulator outputs live here so reviewers can skim a report without running the lab.

## Sample human-readable report

- [`sample-golden-phishing-training-monitoring-report.md`](./sample-golden-phishing-training-monitoring-report.md) — Markdown emitted by `npm run sim:report` after a **`SIMULATION_MODE=local`** rehearsal of [`golden-phishing-training-monitoring`](../../simulator/scenarios/golden-path/golden-phishing-training-monitoring.json).

In **local** mode the scenario intentionally **FAIL**s correlation expectations (no Supabase/Inngest side-effects yet); regenerate under `supabase` / `inngest` plus a staging tenant when validating full orchestration fidelity.
