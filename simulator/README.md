# SecureWatch360 — Attack Simulation & Autonomy Test Lab

Internal **safe** test harness that drives **structured, synthetic** cybersecurity events through SecureWatch360's orchestration surfaces. It validates that agents and workflows behave as expected **without** running real exploits, destructive actions, credential attacks, malware, or unauthorized external scans.

## What this is not

- Not a penetration-testing tool  
- Not a red-team scanner  
- Not a source of live attack traffic  

All events are **metadata-level fixtures** (shapes compatible with findings, alerts, intelligence hooks, etc.) generated in code.

---

## Directory layout

| Path | Role |
|------|------|
| `types.ts` | Core concepts: `Scenario`, `SimulatedEvent`, `ExpectedAgentAction`, `SimulationRun`, `SimulationResult`, `ValidationResult` |
| `schema/` | Zod schemas for scenario JSON documents (base scenario + `attackPlaybook` superset) |
| `scenarios/` | Zod-validated `*.json` scenario definitions consumed by `simulationRunner` |
| `scenarios/golden-path/` | Five investor/demo golden-path playbooks (phishing training, ransomware, RDP exposure, CMMC drift, vulnerable dependency) |
| `engines/` | `simulationRunner`, `eventEmitter`, `failureInjector`, `resultCollector`, `simulationOutcome` |
| `validators/` | `AgentResponseValidator` — compare observed behavior to expectations per agent |
| `reports/` | `reportGenerator`, `autonomyScorecard`, `dashboardSummary` — human and machine-readable outputs |
| `fixtures/` | `demoMode`, `demoClients`, `demoAssets` — fictitious MSSP client fixtures for demo rehearsals |
| `cli/` | `runScenario`, `runAll`, `listScenarios`, `generateReport` — invoked via `npm run sim:*` |
| `tests/` | Vitest smoke / contract tests for the lab module |

---

## Core concepts

1. **Scenario** — Named test case: list of event templates + list of `ExpectedAgentAction` entries. Marked with `assurance` (`synthetic_metadata_only`, `fixture_replay`, `mock_orchestration`).

2. **SimulatedEvent** — One stamped event instance (`runId`, `scenarioId`, `kind`, `payload`). Payloads are plain objects suitable for mapping to existing event names (e.g. `securewatch/monitoring.alert.received`) in a future engine implementation.

3. **ExpectedAgentAction** — What the platform should do (e.g. decision recorded, digest queued). Validators interpret `match` as declarative hints.

4. **SimulationRun** — A single execution: timestamps, environment label, emitted events, optional correlation ids from the sink.

5. **SimulationResult** — Aggregated **pass/fail** for the run plus per-expectation `ValidationResult` rows.

6. **ValidationResult** — Joins an `expectationId` to `passed`, human `detail`, and optional `observed` snapshot.

---

## End-to-end flow (target architecture)

```
Scenario (fixtures)
    → SimulationEngine stamps SimulatedEvent[]
    → failureInjector may mutate events / inject faults
    → OrchestrationEventSink.publish()  [Inngest / Supabase audit / Mock]
    → SecureWatch360 agents & workflows process
    → resultCollector polls signals
    → Validators read audit DB / webhook capture / mock bus
    → autonomyScorecard computes 0–100 score + readiness band
    → dashboardSummary builds compact UI payload
    → SimulationResult + SimulationLabReport + SimulationDashboardSummary
```

Wire production usage with **`SIMULATION_MODE`** — never commit keys.

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `SIMULATION_MODE` | `local` (stdout only), `supabase` (audit ledger rows), `inngest` (audit + workflow fan-out) |
| `SUPABASE_URL` | Overrides project URL — falls back to `NEXT_PUBLIC_SUPABASE_URL` if unset |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role for `audit_logs` inserts (never ship to browsers) |
| `INNGEST_EVENT_KEY` | Required when `SIMULATION_MODE=inngest` |
| `SIMULATION_TENANT_ID` | Tenant UUID scoped to emits + polling (required for `supabase` / `inngest`) |
| `SIMULATION_AGENT_WAIT_MS` | Observation window before result collector polls signals (default `5000`) |
| `SIMULATION_POLL_INTERVAL_MS` | Polling cadence in ms (default `2000`) |
| `SIMULATION_MAX_POLL_ITERATIONS` | Max polling iterations (default `8`) |
| `SIMULATION_RESULTS_DIR` | Overrides JSON artifact folder (defaults to `.simulation-results/`) |
| `SIMULATION_REPORT_OUTPUT_DIR` | Human JSON/Markdown reports (defaults to `simulator/reports/output`) |
| `SIMULATION_DEMO_MODE` | When `true`/`1`/`yes`, orchestration coerced local, fictitious MSSP fixtures, remediation blocked |
| `SIMULATION_EMIT_STAGGER_MS` | Delay between emits (default `250`) |
| `SIMULATION_ENVIRONMENT` | Free-form label embedded in run metadata (e.g. `staging-eu`) |

---

## Running tests

From the repo root:

```bash
npm run test:sim
```

Tests live under `simulator/tests/`. They cover:
- Scenario schema loading and Zod validation
- Simulation runner lifecycle
- Dashboard summary builder
- Failure injector contracts

---

## CLI commands

| Command | What it does |
|---------|--------------|
| `npm run sim:list` | Print discovered scenario ids and names |
| `npm run sim:run -- <id-or-path>` | Run a single scenario by id substring or `.json` path |
| `npm run sim:run-all` | Run every scenario in `simulator/scenarios/` |
| `npm run sim:report` | Generate a human Markdown + JSON report from the latest persisted result |

### Example: run a golden-path scenario

```bash
# by id substring (finds golden-phishing-training-monitoring.json)
npm run sim:run -- golden-phishing

# by explicit path
npm run sim:run -- simulator/scenarios/golden-path/golden-ransomware-isolated-incident-report.json
```

### Example: demo mode rehearsal

```bash
SIMULATION_DEMO_MODE=true npm run sim:run-all
```

In demo mode orchestration stays `local`, emitted events use fictitious client fixtures
(company names, asset hostnames), and live remediation execution is suppressed.
See [Demo mode](#demo-mode) below.

---

## Scenario schema

Scenario fixtures are validated by `simulator/schema/scenario.schema.ts` at load time.

### Base scenario fields

```jsonc
{
  "id": "string",                        // unique stable id
  "name": "string",                      // human label
  "description": "string",
  "severity": "low|medium|high|critical|informational",
  "attack_category": "phishing|ransomware_behavior|...",
  "mitre_attack_techniques": ["T1566"],  // standard MITRE ids
  "target_type": "endpoint|cloud|...",
  "simulated_events": [                  // at least 1 required
    { "ref": "evt-01", "kind": "finding.synthetic", "payload": { ... } }
  ],
  "expected_agent_sequence": [           // at least 1 required
    { "id": "step-1", "agent_key": "agent_1", "capability": "scan", "match": { ... } }
  ],
  "expected_controls_triggered": [
    { "framework": "NIST", "control_id": "SI-3", "control_label": "Malicious Code Protection" }
  ],
  "expected_remediation": {
    "summary": "Isolate endpoint and escalate ticket.",
    "expected_action_types": ["isolate", "ticket"],
    "human_in_the_loop": true
  },
  "expected_report_sections": ["executive_summary", "timeline", "controls"],
  "pass_fail_rules": {
    "agent_sequence_order_required": false,
    "all_report_sections_required": false,
    "min_controls_matched": 1,
    "require_all_agent_steps": false
  },
  "assurance": "synthetic_metadata_only",
  "tags": ["phishing", "awareness"],
  "failure_injection": { ... },          // optional — see Failure injection
  "golden_path_demo": { ... }            // optional — investor narrative
}
```

### Attack playbook superset (pb-*.json files)

Playbook scenarios add narrative-rich fields (no payloads, no exploits):

```jsonc
{
  "playbook_kind": "safe_synthetic_lab",
  "simulated_timeline": [
    { "t_offset_seconds": 0, "phase": "detection", "synthetic_narrative": "..." }
  ],
  "events_emitted": [ { "ref": "evt-01", "headline": "...", "synthetic_detail": "..." } ],
  "expected_agents_triggered": [ { "agent_id": "agent-1-scanner-external-recon", "triggered_reason_synthetic": "..." } ],
  "expected_autonomous_remediation": [ { "synthetic_action": "...", "automation_boundary": "lab_stub_only" } ],
  "expected_human_approval_gates": [ { "gate": "CAB approval", "synthetic_rationale": "..." } ],
  "expected_final_report": { "title": "...", "synthetic_executive_summary": "...", "sections": ["..."] }
}
```

### Simulated event kinds

| Kind | Maps to |
|------|---------|
| `finding.synthetic` | Scanner findings |
| `monitoring.alert.synthetic` | Monitoring alert events |
| `external_intel.synthetic` | Threat intelligence feeds |
| `remediation.execution.synthetic` | Remediation action side-effects |
| `custom.synthetic` | Arbitrary scenario-specific events |

---

## Demo mode

Demo mode isolates rehearsals from live orchestration adapters.

Set `SIMULATION_DEMO_MODE=true` (or pass `simulationDemoMode: true` to `executeScenarioSimulation`).

**What changes:**
- Orchestration sink is forced to `local` regardless of `SIMULATION_MODE`.
- `SimulatedEvent` payloads are annotated with fictitious MSSP client data (`demo_fixture_organization`, `demo_fixture_hostname`, etc.).
- `metadata` gains `sw360_simulation_demo: true`, `data_classification: "simulated_demo_only"`, and `remediation_live_execution_blocked: true`.
- `remediation.execution.synthetic` events are marked `live_change_management_blocked: true`.
- `SimulationDashboardSummary` includes `simulation_demo_mode: true`, `demo_client_display_name`, and `demo_disclaimer`.

**Demo clients** are picked deterministically from `simulator/fixtures/demoClients.ts` by hashing the scenario id. Each client has a vertical (healthcare, finance, etc.) and pre-seeded asset hostnames under `*.sw360-demo.invalid`.

**API badge:** `GET /api/simulation/demo-mode` returns `{ simulationDemoMode: boolean }` so the UI can surface a prominent disclaimer banner.

---

## Failure injection

Scenarios can declare a `failure_injection` block to exercise error paths in the orchestration pipeline during CI drills. Injection is entirely synthetic — it never touches production behavior.

See [`docs/simulator/FAILURE-INJECTION.md`](../docs/simulator/FAILURE-INJECTION.md) for the full reference of all 11 types and JSON examples.

### Quick reference

| Type | Effect |
|------|--------|
| `agent_timeout` | Target agent validator score capped at 20, failure appended |
| `agent_no_response` | Score capped at 15 |
| `agent_late_response` | `delay_ms` sleep before result collector polls |
| `malformed_agent_response` | Score capped at 25 |
| `database_failure` | Suppresses Supabase insert for `event_index` emission (non-`local` only) |
| `inngest_failure` | Suppresses Inngest send for `event_index` emission (`inngest` mode only) |
| `remediation_failure` | Appends failing `injection-remediation` validation |
| `report_generation_failure` | Skips writing human report files |
| `policy_validation_failure` | Flips `aggregation-controls` validation to failed |
| `human_approval_missing` | Appends failing `injection-human-approval` validation |
| `duplicate_event` | Prepends a duplicate of the first stamped event (idempotency test) |

```jsonc
// Minimal injection example (add to scenario JSON):
"failure_injection": {
  "enabled": true,
  "type": "agent_late_response",
  "target_agent": "agent_2",
  "delay_ms": 1200
}
```

---

## Autonomy scorecard

Every run produces an `AutonomyScorecard` that synthesizes detection, agent accuracy, remediation, policy enforcement, and human-intervention burden into a **0–100 score**.

| Score band | Label |
|------------|-------|
| 90–100 | Production-ready (simulation) |
| 75–89 | Strong but needs fixes |
| 60–74 | Partially autonomous |
| 0–59 | Not ready |

See [`docs/simulator/AUTONOMY-SCORECARD.md`](../docs/simulator/AUTONOMY-SCORECARD.md) for the full weight table and interpretation guide.

---

## Dashboard summary API

After running a scenario the structured result JSON is persisted to `.simulation-results/` (or `SIMULATION_RESULTS_DIR`). The Next.js API layer serves a compact `SimulationDashboardSummary` to the UI:

| Endpoint | Description |
|----------|-------------|
| `GET /api/simulation/dashboard-summary` | Latest persisted run summary; `?runId=<uuid>` for a specific run |
| `GET /api/simulation/demo-mode` | Returns `{ simulationDemoMode: boolean }` from server env |

The `SimulationDashboard` UI component (`ui/src/components/SimulationDashboard.tsx`) polls these endpoints and renders the golden-path briefing panel.

---

## Golden-path scenarios

Five investor/demo golden-path playbooks live under `simulator/scenarios/golden-path/`. Each represents a fully narrated attack lifecycle with timeline, expected agents, remediation path, and human approval gates:

| File | Scenario |
|------|----------|
| `golden-phishing-training-monitoring.json` | Phishing campaign → employee training + monitoring |
| `golden-ransomware-isolated-incident-report.json` | Ransomware behavior → endpoint isolation + incident report |
| `golden-msp-rdp-remediated.json` | Public RDP exposure → firewall remediation via MSP |
| `golden-cmmc-drift-corrected.json` | CMMC control drift detected → corrective action + compliance snapshot |
| `golden-vulnerable-dependency-ticket.json` | CVE in dependency → ticket-driven patch workflow |

---

## Importing from application code

```typescript
import type { Scenario, SimulatedEvent } from "../simulator";
// or path alias if you add one in tsconfig
```

(Consider adding `"@sim/*": ["./simulator/*"]` if the lab grows.)

---

## Safety rules

1. Never import real exploit code, payloads, or third-party offensive tools.  
2. Use `.invalid` / `example.test` hostnames and obvious `LAB:` prefixes in titles.  
3. Default sink in CI must be **in-memory or recorded mock** unless an operator explicitly targets an isolated staging tenant.  
4. Keep scenarios versioned and reviewed like migrations.
