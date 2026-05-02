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
| `scenarios/` | Scenario registry and loaders (future) |
| `engines/` | `SimulationEngine` and `OrchestrationEventSink` — how events enter Inngest/API/mocks |
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

The repository currently contains **interfaces, types, one fixture, and smoke tests**. Wiring to `inngest.send` or route handlers belongs in `engines/` implementations behind configuration flags (`SIMULATION_LAB_ENABLED`, etc.) — not enabled by default in production.

## Safety rules

1. Never import real exploit code, payloads, or third-party offensive tools.  
2. Use `.invalid` / `example.test` hostnames and obvious `LAB:` prefixes in titles.  
3. Default sink in CI must be **in-memory or recorded mock** unless an operator explicitly targets an isolated staging tenant.  
4. Keep scenarios versioned and reviewed like migrations.

## Running tests

From the repo root:

```bash
npm run test -- simulator/tests
```

## Importing from application code

```typescript
import type { Scenario, SimulatedEvent } from "../simulator";
// or path alias if you add one in tsconfig
```

(Consider adding `"@sim/*": ["./simulator/*"]` if the lab grows.)
