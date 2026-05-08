# Investor Demo — `src/demo/investorMode`

A safe, repeatable, fully simulated **ransomware-precursor scenario** for the
SecureWatch360 investor demo. Nothing in this module talks to real customer
infrastructure, real malware, or real endpoints.

## Scenario

> **Ransomware precursor against Acme Dental**, an MSP client managed by
> Northstar Managed IT.

| Field | Value |
| --- | --- |
| Client | Acme Dental (synthetic) |
| Industry | Healthcare |
| Size | 74 employees |
| Compliance | HIPAA + CMMC readiness |
| Critical asset | `ACME-FS01` (PHI-bearing file server) |
| User involved | Sarah Mitchell (Front Desk Coordinator) |
| Endpoint | `LAPTOP-123` |
| Entry vector | Stale RDP exposure, 187 days old |
| Threat | Ransomware-precursor behavior chain |

## Timeline

The replay engine emits the canonical 15-step timeline below. All offsets
are seconds since `demo_started`.

| Step | Offset | Event | Actor |
| ---: | ---: | --- | --- |
| 1 | 0s | `demo_started` | system |
| 2 | 3s | `detection_powershell` | system |
| 3 | 6s | `detection_file_access` | system |
| 4 | 9s | `detection_credential_access` | system |
| 5 | 12s | `agent_classification` (Agent 5) | agent |
| 6 | 15s | `agent_correlation` (Agent 2) | agent |
| 7 | 18s | `agent_compliance_check` (Agent 3) | agent |
| 8 | 21s | `containment_recommended` | agent |
| 9 | 24s | `voice_confirmation_requested` | voice |
| 10 | 30s | `admin_confirmation_received` | admin |
| 11 | 33s | `endpoint_isolated` | system |
| 12 | 37s | `ticket_created` | system |
| 13 | 42s | `executive_report_generated` | system |
| 14 | 48s | `business_impact_summary_generated` | system |
| 15 | 55s | `demo_completed` | system |

## Persistence

When `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are both
set, every event is written to the `audit_logs` table with
`entity_type='system'`, `entity_id=<demoRunId>` and `action='demo.<type>'`.
Otherwise the module falls back to a process-local in-memory store so the
demo runs on a developer laptop with zero infra.

## Entry points

```ts
import {
  startDemoReplay,
  resetDemo,
  buildAllDemoReports,
  resolveDemoSink,
  DEMO_SCENARIO_META,
} from "@/demo/investorMode";

// 1. (optional) wipe any previous run
await resetDemo();

// 2. fire the timeline
const sink = resolveDemoSink();
const handle = startDemoReplay({ sink, speedMultiplier: 1 });
await handle.completion;

// 3. crunch reports for the UI
const events = await sink.list(handle.demoRunId);
const { metrics, executiveReport, businessImpactSummary } = buildAllDemoReports(events);
```

## Reset

```bash
# tsx one-liner — wipes the demo events and re-arms the seed snapshot
npx tsx -e "require('./src/demo/investorMode').runResetCli()"
```

## Safety guarantees

- No shell commands are executed against real machines.
- No real malware names are referenced as operational instructions.
- All identities, hostnames, and IPs are fictional.
- The demo tenant id (`b2c7d5e9-6014-5a8b-bc11-ffffffffd001`) lives in the
  `...ffff...d0xx` namespace so it is trivial to filter out of production
  analytics.
- Timeline invariants are validated at module load and again on every
  `resetDemo()` call.

## Tests

Vitest suites live in `__tests__/` and cover:

- Replay-engine emission order and clock injection (`demoReplayEngine.test.ts`)
- Reset behaviour and idempotency (`demoResetService.test.ts`)
- Metrics computation against the canonical timeline (`demoMetricsService.test.ts`)

Run them with:

```bash
npm test -- src/demo/investorMode
```
