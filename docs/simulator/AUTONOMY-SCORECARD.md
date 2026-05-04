# Autonomy Scorecard

The **Autonomy Scorecard** (`simulator/reports/autonomyScorecard.ts`) synthesises the output of a simulation run into a structured set of metrics and a single **0–100 composite score** that reflects how autonomously SecureWatch360 handled the synthetic scenario.

It is computed at the end of every `executeScenarioSimulation` call and attached to both the structured lab report and the `SimulationDashboardSummary`.

---

## Readiness bands

The composite score maps to a human readiness label shown in the UI and reports:

| Score range | `readiness_band` | Dashboard label |
|-------------|-----------------|----------------|
| 90–100 | `production_ready` | Production-ready (simulation) |
| 75–89 | `strong_needs_fixes` | Strong but needs fixes |
| 60–74 | `partially_autonomous` | Partially autonomous |
| 0–59 | `not_ready` | Not ready |

> Bands are heuristic baselines for the simulator. A "production-ready" label in the lab means the synthetic test passed with high fidelity; it does not substitute for real-tenant QA (`npm run qa:v4:agents`).

---

## Scorecard fields

All ratio fields (`*_success_rate`, `*_risk`, `human_intervention_required`) are normalised to **[0, 1]** — multiply by 100 for a percentage.

| Field | Type | Meaning |
|-------|------|---------|
| `detection_success_rate` | `number` [0,1] | How reliably the scenario events correlated with observed audit/agent signals |
| `agent_trigger_accuracy` | `number` [0,1] | Weighted accuracy across all agent validator checklist scores |
| `remediation_success_rate` | `number` [0,1] | Probability the modelled remediation path completed without unresolved friction |
| `policy_enforcement_success_rate` | `number` [0,1] | Whether the `aggregation-controls` gate (and broader policy rules) passed |
| `false_positive_risk` | `number` [0,1] | Higher = more suspicion that benign events were treated as incidents |
| `false_negative_risk` | `number` [0,1] | Higher = concern that real issues were missed or not validated |
| `human_intervention_required` | `number` [0,1] | Fraction of the run that required manual gates (approvals, HIL paths) |
| `time_to_detect_seconds` | `number \| null` | Delta from first emit to first correlated audit row (null if insufficient telemetry) |
| `time_to_triage_seconds` | `number \| null` | Observation window duration; null if start/end timestamps unavailable |
| `time_to_remediate_seconds` | `number \| null` | Delta from first emit to `remediation.execution.synthetic` event; estimated if absent |
| `report_quality_score` | `number` [0,100] | Richness proxy based on `expected_report_sections` count and pass outcome |
| `overall_autonomy_score` | `number` [0,100] | Weighted composite — the headline metric |
| `readiness_band` | `AutonomyReadinessBand` | Categorical bucket derived from `overall_autonomy_score` |

---

## Composite score formula

The `overall_autonomy_score` is a **weighted sum** of seven component terms, each scaled to 0–100, plus a small timing bonus:

```
overall = Σ( component_i × weight_i )  +  timing_bonus
```

### Component weights

| Component | Derived from | Weight |
|-----------|-------------|--------|
| `detection_success_rate × 100` | Agent sequence validations + audit correlation | **0.14** |
| `agent_trigger_accuracy × 100` | Agent validator checklist scores | **0.22** |
| `remediation_success_rate × 100` | Keyword heuristic + policy gate blend | **0.13** |
| `policy_enforcement_success_rate × 100` | `aggregation-controls` gate | **0.13** |
| `(1 − false_positive_risk) × 100` | Agent warning mass + audit absence | **0.14** |
| `(1 − false_negative_risk) × 100` | Failed agent steps + overall pass | **0.12** |
| `(1 − human_intervention_required) × 100` | HIL flag + approval gate count | **0.09** |
| `report_quality_score` | Section count + pass outcome | **0.03** |

Weights sum to **1.00**. The heaviest component is **agent trigger accuracy** (0.22), reflecting that correct agent behaviour is the primary signal of platform autonomy.

### Timing bonus

A small additive bonus (up to +2.5 points) is applied when modelled timing indicates brisk response:

- **+1.25** if `time_to_detect_seconds < 180` (3 minutes)
- **+1.25** if `time_to_triage_seconds < 600` (10 minutes)

The bonus is capped so the maximum composite score remains 100.

---

## How each metric is derived

### `detection_success_rate`

1. Start from the fraction of `expected_agent_sequence` steps that produced passing `ValidationResult` rows (falls back to 0.95/0.45 if no agent-sequence validations exist).
2. **Boost +5 %** if `auditRowsForRun > 0` (correlation evidence exists).
3. **Penalise −22 %** if neither run-specific nor timeline-adjacent audit rows exist.

### `agent_trigger_accuracy`

1. Average of `score / 100` across `AgentValidatorResult[]` (one per agent checked).
2. Falls back to agent-sequence validation fraction if no agent results exist.

### `policy_enforcement_success_rate`

- `1.0` if the `aggregation-controls` validation row passed.
- `0.35` if it failed.
- `0.75` / `0.4` heuristic if the row is absent (based on overall pass outcome).

### `remediation_success_rate`

1. Keyword search over combined audit haystack + validation details + event payloads for remediation-related terms (`remediation`, `patch`, `isolate`, `quarantine`, `revoke`, `rollback`, `cab`, `ticket`).
2. If keywords found: `policy_enforcement_success_rate × 0.85 + 0.15`.
3. Otherwise: `detection_success_rate × 0.9`.
4. **Boost +5 %** if `human_in_the_loop: false` (fully autonomous path).
5. **Penalise −15 %** if no keywords found **and** no audit rows.

### `false_positive_risk`

- Base: `agentWarnings.total / 18` (normalised; >18 warnings → risk = 1.0).
- **+0.28** when run passed but produced zero audit rows (no corroboration).

### `false_negative_risk`

- Base: fraction of agent-sequence steps that failed.
- **+0.22** if overall `SimulationResult.passed` is false.
- **+0.12** if `require_all_agent_steps: true` and any step failed.

### `human_intervention_required`

- Base: `0.45` if `expected_remediation.human_in_the_loop: true`, else `0.18`.
- For attack-playbook scenarios: `+0.12` per approval gate, `+0.06` if more than 3 gates.

### Timing fields

| Field | Source |
|-------|--------|
| `time_to_detect_seconds` | `first_audit_row.created_at − first_event.simulatedAt` |
| `time_to_triage_seconds` | `observationWindowEndIso − observationWindowStartIso` (or run duration) |
| `time_to_remediate_seconds` | `remediation.execution.synthetic` event timestamp − first emit; estimated proportionally when absent |

All timing fields return `null` in `local` observation mode when there are no audit rows to measure against.

---

## Effect of failure injection

Scenarios with active `failure_injection` blocks will score lower in predictable ways:

| Injection type | Primary metric impacted |
|----------------|------------------------|
| `agent_timeout` / `agent_no_response` / `malformed_agent_response` | `agent_trigger_accuracy` ↓ |
| `policy_validation_failure` | `policy_enforcement_success_rate` ↓ → `overall_autonomy_score` ↓ |
| `remediation_failure` | `remediation_success_rate` ↓ |
| `human_approval_missing` | `false_negative_risk` ↑ |
| `database_failure` / `inngest_failure` | `detection_success_rate` ↓ (no audit rows) |

This is intentional — failure injection tests verify that the scorecard reflects real degradations rather than masking them.

---

## Interpreting a low score

A score below 60 (`not_ready`) in a local run is expected and normal — it usually means the simulation ran without Supabase/Inngest side-effects so audit correlation rows are absent. The score improves significantly when running against a staging tenant with `SIMULATION_MODE=supabase` or `inngest`.

Steps to improve a score:

1. Run with `SIMULATION_MODE=supabase` + valid `SIMULATION_TENANT_ID` to get audit correlation.
2. Ensure all `expected_agent_sequence` steps have matching `agent_key` and `capability` in validators.
3. Review `nextRecommendedAction` in the dashboard summary — it surfaces the highest-leverage fix.
4. Add `remediation.execution.synthetic` events to the scenario if remediation timing matters.
5. Check `false_positive_risk` — if >0.5, reduce warnings in agent validators or add explicit audit evidence.

---

## TypeScript interface

```typescript
// simulator/reports/autonomyScorecard.ts
export interface AutonomyScorecard {
  detection_success_rate: number;       // [0,1]
  agent_trigger_accuracy: number;       // [0,1]
  remediation_success_rate: number;     // [0,1]
  policy_enforcement_success_rate: number; // [0,1]
  false_positive_risk: number;          // [0,1]
  false_negative_risk: number;          // [0,1]
  human_intervention_required: number;  // [0,1]
  time_to_detect_seconds: number | null;
  time_to_triage_seconds: number | null;
  time_to_remediate_seconds: number | null;
  report_quality_score: number;         // [0,100]
  overall_autonomy_score: number;       // [0,100]
  readiness_band: AutonomyReadinessBand;
}
```
