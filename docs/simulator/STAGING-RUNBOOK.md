# Simulator — staging (Supabase + Inngest)

Use this when you want **real** staging side effects (audit rows and optionally the **`securewatch/monitoring.alert.received`** workflow), not **`SIMULATION_MODE=local`** console-only rehearsals.

## Preconditions

1. **`SIMULATION_DEMO_MODE` off** — demo mode forces the orchestration sink to **local**, bypassing staging integration.
2. Staging **`SIMULATION_TENANT_ID`** must be an existing **`tenants`** row UUID used for `audit_logs.tenant_id` and Ingest payloads.
3. Secrets only in `.env.local` / your secret manager — never commit keys.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `SIMULATION_MODE` | `supabase` (audit only) or `inngest` (audit **+** Inngest fan-out). |
| `SIMULATION_TENANT_ID` | Required for `supabase` / `inngest`. |
| `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` | Staging project URL (`getSupabaseProjectUrlFromEnv` prefers `SUPABASE_URL`). |

| `SUPABASE_SERVICE_ROLE_KEY` | Admin client for **`audit_logs`** inserts. |

| `INNGEST_EVENT_KEY` | Required when `SIMULATION_MODE=inngest` (matches `simulator/engines/eventEmitter.ts`). |

| `SIMULATION_POLL_INTERVAL_MS`, `SIMULATION_MAX_POLL_ITERATIONS`, `SIMULATION_AGENT_WAIT_MS` | Tune observation / polling (`simulator/engines/resultCollector.ts`; CLI default may set agent wait `0`). |



PowerShell example:



```powershell

$env:SIMULATION_MODE = "inngest"

$env:SIMULATION_TENANT_ID = "<staging-tenant-uuid>"

$env:SUPABASE_URL = "https://<project>.supabase.co"

$env:SUPABASE_SERVICE_ROLE_KEY = "<service-role>"

$env:INNGEST_EVENT_KEY = "<staging-event-key>"



npm run sim:run -- --scenario golden-phishing-training-monitoring

```



## What gets exercised



| Mode | `audit_logs` | Inngest |
|------|--------------|---------|

| `supabase` | Inserts **`simulation.synthetic_event_emitted`** per event (`eventEmitter.ts`) | No |

| `inngest` | Same inserts | Sends **`securewatch/monitoring.alert.received`** with monitoring-shaped `data`; handled by `src/inngest/functions/monitoring-alert-received.ts` (e.g. `scan_runs` for monitoring alerts). |



Validators poll **`audit_logs`** for payloads keyed by **`simulation_run_id`** (see **`observeAgentSignals`** in `resultCollector.ts`). Expectations compare against audit text blobs; scores improve when workflows add matching audit signals.



## Verify



- **Supabase:** `audit_logs` for staging tenant — `simulation.synthetic_event_emitted` and payload `simulation_run_id`.  

- **Inngest dashboard:** runs for `securewatch/monitoring.alert.received`.  

- **CLI:** emitted `runId=`; artifacts under `.simulation-results/` (override with `SIMULATION_RESULTS_DIR`).



For local-only rehearsals and artifact layout, see `simulator/README.md` at repo root and `README.md` in this folder.


