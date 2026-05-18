# Simulator Agent Validators

`simulator/validators/` contains deterministic post-run validators that inspect captured telemetry and assert that each SecureWatch360 agent behaved correctly during a simulation run.

## What validators do

After a simulation run, the orchestrator calls `runAllSecureWatchAgentValidators(ctx)`.  Each validator:

1. Builds a searchable text blob from audit rows and synthetic events.
2. Checks a fixed checklist of expectations against that blob.
3. Returns a scored `AgentValidatorResult` (`passed`, `score` 0–100, `failures`, `warnings`, `evidence`).

Validators are **heuristic** — they use keyword matching and event-kind counting rather than strict schema validation.  They are intended for lab/staging use, not as production policy gates.

---

## Agents covered

| Agent ID | Validator file | Scenario focus |
|---|---|---|
| `agent-1-scanner-external-recon` | `agent1.validator.ts` | External attack surface discovery, cloud posture |
| `agent-2-vuln-analysis` | `agent2.validator.ts` | Vulnerability CVE analysis and scoring |
| `agent-3-compliance` | `agent3.validator.ts` | Compliance drift and control gap detection |
| `agent-4-incident` | `agent4.validator.ts` | Incident lifecycle (containment, isolation) |
| `agent-5-awareness` | `agent5.validator.ts` | Security awareness and training signals |

---

## Entry points

```typescript
import { runAllSecureWatchAgentValidators } from "simulator/validators";

const results = runAllSecureWatchAgentValidators(ctx);
// results[0] = Agent 1 result, results[4] = Agent 5 result
```

To run a single validator:

```typescript
import { validateAgent1Response } from "simulator/validators";
const result = validateAgent1Response(ctx);
```

To check whether a scenario is primarily in scope for a given agent:

```typescript
import { isAgent1ScenarioLikely } from "simulator/validators";
if (isAgent1ScenarioLikely(ctx)) { /* ... */ }
```

---

## Validator context (`AgentValidatorContext`)

```typescript
interface AgentValidatorContext {
  scenario: ScenarioDefinition;   // the running scenario definition
  runId: string;                  // simulation run UUID
  signals: CollectedSignals;      // audit rows gathered from Supabase
  stampedEvents: SimulatedEvent[];// synthetic events emitted during the run
}
```

`CollectedSignals` contains two audit row lists:
- `auditRowsForRun` — rows correlated to this specific `runId`
- `auditRowsNearTimeline` — rows within the simulation timeline window (broader context)

---

## AgentValidatorResult

```typescript
interface AgentValidatorResult {
  agentId: string;
  passed: boolean;        // true when all checklist items pass
  score: number;          // 0–100 (percentage of passing checklist items)
  failures: string[];     // checklist IDs + messages for failed items
  warnings: string[];     // informational observations (do not affect passed/score)
  evidence: {
    checklist: Record<string, boolean>;
    note: string;
    [key: string]: unknown;   // validator-specific extras
  };
}
```

---

## Shared utilities (`agentValidatorShared.ts`)

### `auditHaystackFromSignals(signals)`

Merges `auditRowsForRun` and `auditRowsNearTimeline` (de-duplicated by id), concatenates `action + JSON.stringify(payload)` for each row, lowercases the result.  Used by all validators for heuristic keyword matching.

### `eventsHaystack(events)`

Same operation for `stampedEvents`: concatenates `kind + JSON.stringify(payload)`, lowercased.

### `unsafeInstructionScan(blob)`

Scans audit + event text for wording that would be dangerous outside a lab context:

| Pattern | Severity |
|---|---|
| `DROP TABLE` / `TRUNCATE TABLE` | Failure (unless synthetic lab wording present) |
| `bypass RLS` | Failure (unless synthetic lab wording present) |
| `curl ... \| bash` | Failure (unless synthetic lab wording present) |
| `rm -rf /` (non-`/tmp`) | Warning |
| `SERVICE_ROLE_KEY` / `SUPABASE_SERVICE_ROLE` | Warning |

When `lab:`, `lab-`, `synthetic_metadata_only`, or similar lab-safe markers appear anywhere in the blob, critical patterns are downgraded to warnings rather than failures.

### `collectExpectedStepsForAgents(scenario, agentAliases)`

Filters `scenario.expected_agent_sequence` to steps whose `agent_key` contains any of the provided alias strings (case-insensitive).  Returns the matching steps so validators can check whether expected orchestration steps were observed.

### `buildAgentValidatorResult(agentId, checks, evidenceExtra?)`

Converts an ordered `CheckItem[]` into an `AgentValidatorResult`:

- `score = round( (passing items / total items) × 100 )`
- `passed = failures.length === 0 && all items ok`
- Collecting failure messages from `failureMessage` and warning messages from `warningMessage`

---

## Checklist pattern (Agent 1 example)

All per-agent validators follow the same structure:

```typescript
const checks: CheckItem[] = [
  { id: "triggered",           ok: !inScope || triggered,   failureMessage: "..." },
  { id: "correct_event",       ok: !inScope || correctEvent, failureMessage: "..." },
  { id: "severity_classification", ok: !inScope || severityOk, failureMessage: "..." },
  { id: "expected_action",     ok: !inScope || actionOk,    failureMessage: "..." },
  { id: "database_record",     ok: dbRecord,                failureMessage: "..." },
  { id: "reportable_finding",  ok: !inScope || findingLikely, failureMessage: "..." },
  { id: "safety_guardrails",   ok: safety.failures.length === 0, failureMessage: ... },
];
return buildAgentValidatorResult(AGENT_ID, checks, { inScope, ... });
```

**Out-of-scope relaxation:** if `isAgentNScenarioLikely(ctx)` returns `false`, the agent-specific checks are set to `ok: true` with a warning note.  Only `database_record` and `safety_guardrails` are always evaluated regardless of scenario scope.

---

## Interpreting results in CI / staging

A passing run (`passed === true`) means all checklist items succeeded.  A `score` below 100 with `passed === false` indicates which specific checks failed — inspect `failures[]` for details.

Typical reasons for partial failures in **local** (non-Supabase) mode:

- `database_record` fails because no Supabase audit rows exist — expected in `SIMULATION_MODE=local`.
- `triggered` / `correct_event` may be absent when running a scenario outside the agent's primary scope.

For production-fidelity validation, run in `SIMULATION_MODE=supabase` following `docs/simulator/STAGING-RUNBOOK.md`.

---

## Adding a new agent validator

1. Create `simulator/validators/agentN.validator.ts` following the same structure.
2. Export `AGENT_N_ID`, `isAgentNScenarioLikely`, and `validateAgentNResponse`.
3. Add imports and exports to `simulator/validators/index.ts`.
4. Add a call inside `runAllSecureWatchAgentValidators()`.
5. Extend `docs/simulator/AUTONOMY-SCORECARD.md` with the new agent's scoring criteria.
