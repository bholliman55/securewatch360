# SecureWatch360 — Attack Simulation & Autonomy Test Lab

Internal **safe** test harness that drives **structured, synthetic** cybersecurity events through SecureWatch360’s orchestration surfaces. It validates that agents and workflows behave as expected **without** running real exploits, destructive actions, credential attacks, malware, or unauthorized external scans.

## What this is not

- Not a penetration-testing tool  
- Not a red-team scanner  
- Not a source of live attack traffic  

All events are **metadata-level fixtures** (shapes compatible with findings, alerts, intelligence hooks, etc.) generated in code.

## Directory layout

| Path | Role |
|------|------|
| `types.ts` | Core concepts: `Scenario`, `SimulatedEvent`, `ExpectedAgentAction`, `SimulationRun`, `SimulationResult`, `ValidationResult` |
| `scenarios/` | Zod-validated `*.json` scenario definitions consumed by `simulationRunner` |
| `engines/` | `simulationRunner`, `eventEmitter` (console / Supabase `audit_logs` / Inngest), `resultCollector` |
| `validators/` | `AgentResponseValidator` — compare observed behavior to expectations |
| `reports/` | Serializable lab report types for CI artifacts |
| `fixtures/` | Declarative synthetic scenarios (no hostile strings) |
| `tests/` | Vitest smoke / contract tests for the lab module |

## Core concepts

1. **Scenario** — Named test case: list of event templates + list of `ExpectedAgentAction` entries. Marked with `assurance` (`synthetic_metadata_only`, `fixture_replay`, `mock_orchestration`).

2. **SimulatedEvent** — One stamped event instance (`runId`, `scenarioId`, `kind`, `payload`). Payloads are plain objects suitable for mapping to existing event names (e.g. `securewatch/monitoring.alert.received`) in a future engine implementation.

3. **ExpectedAgentAction** — What the platform should do (e.g. decision recorded, digest queued). Validators interpret `match` as declarative hints.

4. **SimulationRun** — A single execution: timestamps, environment label, emitted events, optional correlation ids from the sink.

5. **SimulationResult** — Aggregated **pass/fail** for the run plus per-expectation `ValidationResult` rows.

6. **ValidationResult** — Joins an `expectationId` to `passed`, human `detail`, and optional `observed` snapshot.

## End-to-end flow (target architecture)

```
Scenario (fixtures)
    → SimulationEngine stamps SimulatedEvent[]
    → OrchestrationEventSink.publish()  [Inngest / API adapter / Mock]
    → SecureWatch360 agents & workflows process
    → Validators read audit DB / webhook capture / mock bus
    → SimulationResult + SimulationLabReport
```

Wire production usage with **`SIMULATION_MODE`** — never commit keys.

### Environment variables (`simulation runner`)

| Variable | Purpose |
|----------|---------|
| `SIMULATION_MODE` | `local` (stdout only), `supabase` (audit ledger rows), `inngest` (audit + workflow fan-out) |
| `SUPABASE_URL` | Overrides project URL — falls back to `NEXT_PUBLIC_SUPABASE_URL` if unset |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role for `audit_logs` inserts (never ship to browsers) |
| `INNGEST_EVENT_KEY` | Required when `SIMULATION_MODE=inngest` |
| `SIMULATION_TENANT_ID` | Tenant UUID scoped to emits + polling (required for `supabase` / `inngest`) |
| `SIMULATION_AGENT_WAIT_MS`, `SIMULATION_POLL_INTERVAL_MS`, `SIMULATION_MAX_POLL_ITERATIONS` | Observation window tuning |
| `SIMULATION_RESULTS_DIR` | Overrides JSON artifact folder (defaults to `.simulation-results/`) |
| `SIMULATION_REPORT_OUTPUT_DIR` | Human JSON/Markdown reports (defaults to `simulator/reports/output`) |
| `SIMULATION_DEMO_MODE` | When `true`, coerces orchestration to `local`, stamps fictitious MSSP fixtures, blocks live remediation hooks |
| `SIMULATION_EMIT_STAGGER_MS` | Delay between emits (default `250`) |

## Safety rules

1. Never import real exploit code, payloads, or third-party offensive tools.  
2. Use `.invalid` / `example.test` hostnames and obvious `LAB:` prefixes in titles.  
3. Default sink in CI must be **in-memory or recorded mock** unless an operator explicitly targets an isolated staging tenant.  
4. Keep scenarios versioned and reviewed like migrations.

## Running tests

From the repo root:

```bash
npm run test:sim
```

Golden-path fixtures live under `simulator/scenarios/golden-path/`; resolve them by **`id`/stem substring** (`golden-phishing-training-monitoring`) or pass a **path** ending in `.json`.

## Importing from application code

```typescript
import type { Scenario, SimulatedEvent } from "../simulator";
// or path alias if you add one in tsconfig
```

(Consider adding `"@sim/*": ["./simulator/*"]` if the lab grows.)
