# Simulator Failure Injection Reference

SecureWatch360's simulation lab supports **scenario-driven fault injection** for CI drills and resilience testing. Failure injection is entirely synthetic — it never mutates production behavior outside the simulator.

Injection is declared in a `failure_injection` block inside any scenario JSON file. The block is optional; omitting it (or setting `"enabled": false`) runs the scenario normally.

---

## Anatomy of a failure_injection block

```jsonc
"failure_injection": {
  "enabled": true,
  "type": "<injection-type>",      // required — one of 11 values below
  "target_agent": "agent_1",       // optional — which agent validator to mutate
  "delay_ms": 1200,                // optional — used by agent_late_response
  "event_index": 0                 // optional — 0-based index for database/inngest faults
}
```

### Field reference

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `enabled` | `boolean` | — | Must be `true` for injection to apply |
| `type` | `FailureInjectionType` | — | Which fault to inject (see table below) |
| `target_agent` | `string` | `"agent_1"` | Agent validator to target; accepts `agent_1`/`agent1`/`1` shorthand aliases |
| `delay_ms` | `number` | `750` | Millisecond sleep before result collection (`agent_late_response` only) |
| `event_index` | `number` | `0` | 0-based index of `simulated_events` array entry to fault (`database_failure` / `inngest_failure`) |

---

## Injection types

### Agent validator faults

These mutate the `AgentValidatorResult` produced by agent checklist validators **after** the run completes. They do not affect event emission.

#### `agent_timeout`

Simulates an agent that timed out before producing a usable response.

- Caps agent validator `score` to `20`.
- Sets `passed: false`.
- Appends `"failure_injection: agent timed out before producing a usable response."` to `failures[]`.

```jsonc
"failure_injection": {
  "enabled": true,
  "type": "agent_timeout",
  "target_agent": "agent_2"
}
```

---

#### `agent_no_response`

Simulates an agent that produced no observable response within the lab window.

- Caps `score` to `15`.
- Sets `passed: false`.
- Appends `"failure_injection: agent produced no observable response within the lab window."` to `failures[]`.

```jsonc
"failure_injection": {
  "enabled": true,
  "type": "agent_no_response",
  "target_agent": "agent_5"
}
```

---

#### `agent_late_response`

Simulates an agent that is slow to respond. Introduces a real `delay_ms` sleep **before** the result collector polls for signals, causing the observation window to start late.

Does **not** change `passed` or `score` — it exercises timing-sensitive polling logic.

```jsonc
"failure_injection": {
  "enabled": true,
  "type": "agent_late_response",
  "delay_ms": 2500
}
```

---

#### `malformed_agent_response`

Simulates an agent that produced output that fails structural validation.

- Caps `score` to `25`.
- Sets `passed: false`.
- Appends `"failure_injection: agent output failed structural validation (malformed)."` to `failures[]`.

```jsonc
"failure_injection": {
  "enabled": true,
  "type": "malformed_agent_response",
  "target_agent": "agent_3"
}
```

---

### Orchestration sink faults

These fault the **emission** of a specific simulated event (`event_index`).

#### `database_failure`

Suppresses the Supabase `audit_logs` insert for the targeted event emission. Applies only when `SIMULATION_MODE` is `supabase` or `inngest`; ignored in `local` mode.

Tests resilience to intermittent DB write failures (event still stamped and counted, but no `auditLogId` correlation returned).

```jsonc
"failure_injection": {
  "enabled": true,
  "type": "database_failure",
  "event_index": 0
}
```

---

#### `inngest_failure`

Suppresses the Inngest event send for the targeted emission. Applies only when `SIMULATION_MODE=inngest`; ignored otherwise.

Tests that the runner handles Inngest publish errors gracefully without crashing.

```jsonc
"failure_injection": {
  "enabled": true,
  "type": "inngest_failure",
  "event_index": 1
}
```

---

### Pipeline validation faults

These mutate the `SimulationResult.validations` array **after** evaluation and before the scorecard is computed.

#### `remediation_failure`

Appends a failing `ValidationResult` row with `expectationId: "injection-remediation"`.

Verifies that downstream dashboards and scorecards handle a remediation miss correctly.

```jsonc
"failure_injection": {
  "enabled": true,
  "type": "remediation_failure"
}
```

---

#### `report_generation_failure`

Skips writing the human-readable JSON and Markdown report files. The structured in-memory report is still built; only disk writes are suppressed.

The `SimulationLabReport` gains a `report_generation.skipped: true` field so callers can detect the injection.

```jsonc
"failure_injection": {
  "enabled": true,
  "type": "report_generation_failure"
}
```

---

#### `policy_validation_failure`

Flips the `aggregation-controls` validation row to `passed: false` (or inserts a new failing row if absent).

Exercises the dashboard `controlsValidated` rendering path for a failed controls gate.

```jsonc
"failure_injection": {
  "enabled": true,
  "type": "policy_validation_failure"
}
```

---

#### `human_approval_missing`

Appends a failing `ValidationResult` with `expectationId: "injection-human-approval"`.

Simulates a scenario where a required approval gate was never fulfilled.

```jsonc
"failure_injection": {
  "enabled": true,
  "type": "human_approval_missing"
}
```

---

### Event integrity faults

#### `duplicate_event`

Prepends a copy of the first stamped `SimulatedEvent` with a `-duplicate-injection` id suffix and `metadata.simulator_duplicate_injection: true`.

Tests idempotency — validators and result collectors should not double-count an event that appears twice.

```jsonc
"failure_injection": {
  "enabled": true,
  "type": "duplicate_event"
}
```

---

## Agent target aliases

The `target_agent` field accepts any of these aliases for the five canonical lab agents:

| Alias values | Resolves to |
|--------------|-------------|
| `agent_1`, `agent1`, `"1"` | `agent-1-scanner-external-recon` |
| `agent_2`, `agent2`, `"2"` | `agent-2-osint-vuln-intel` |
| `agent_3`, `agent3`, `"3"` | `agent-3-compliance-policy` |
| `agent_4`, `agent4`, `"4"` | `agent-4-awareness-phishing-training` |
| `agent_5`, `agent5`, `"5"` | `agent-5-monitoring-incident-response` |

You can also pass the full canonical id directly.

---

## Effect on autonomy scorecard

Injected failures propagate into the autonomy scorecard:

- **Agent score faults** (`agent_timeout`, `agent_no_response`, `malformed_agent_response`) lower `agent_trigger_accuracy` because scorecard weights normalised agent scores.
- **Pipeline faults** (`policy_validation_failure`, `remediation_failure`, `human_approval_missing`) lower `policy_enforcement_success_rate` and `remediation_success_rate`, which directly reduce `overall_autonomy_score`.
- **Infrastructure faults** (`database_failure`, `inngest_failure`) reduce `detection_success_rate` by suppressing audit correlation rows.
- **`duplicate_event`** may increase `false_positive_risk` if validators count both events.

This means a scenario with active failure injection will realistically score lower and produce a lower `readiness_band` — which is the intended behavior.

---

## CI usage pattern

Add an injection-enabled scenario alongside your normal golden-path fixtures:

```jsonc
// simulator/scenarios/ci-failure-drills/database-fault-drill.json
{
  "id": "ci-database-fault-drill",
  "name": "CI — database write fault drill",
  "assurance": "synthetic_metadata_only",
  // ... standard scenario fields ...
  "failure_injection": {
    "enabled": true,
    "type": "database_failure",
    "event_index": 0
  }
}
```

Run with:

```bash
SIMULATION_MODE=supabase SIMULATION_TENANT_ID=<ci-tenant-uuid> \
  npm run sim:run -- ci-database-fault
```

Expect `SimulationResult.passed` to be `false` (or `partial`) and inspect `telemetry.emissions[0].inject_error` in the persisted report JSON to confirm the fault fired.
