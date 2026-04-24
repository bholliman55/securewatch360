# SecureWatch360 v4

SecureWatch360 is a multi-tenant security operations platform built with Next.js, Inngest, and Supabase.

v4 focuses on decisioning, explainability, and action routing:

- centralized policy decision evaluation for findings
- policy-as-code storage and optional OPA-compatible evaluation
- approval and risk-exception workflows
- compliance and remediation agent hooks
- explainability views for decisions, approvals, and exceptions
- expanded compliance/policy catalog coverage for 11 frameworks

This README is engineering-focused and reflects the current implementation.
See `docs/V4-ENGINEERING-GUARDRAILS.md` for scope/complexity constraints used for v4 changes.

## What v4 adds on top of v3

Compared to v3 (scan/findings/remediation/compliance baseline), v4 adds:

- **Central decisioning model**
  - `decision_input` and `decision_result` snapshots on findings/remediation actions
  - unified `evaluateDecision()` entrypoint
- **Policy-as-code persistence**
  - `policies`, `policy_bindings`, `policy_decisions` tables
  - immutable decision logs for each evaluated finding
- **Approval and exception workflows**
  - `approval_requests` table + APIs
  - `risk_exceptions` table + APIs
- **Execution-aware remediation**
  - separate `execution_status`, `execution_mode`, `execution_payload` on remediation actions
- **Agent-style hooks**
  - `complianceAgent` for control mapping/evidence/impact tagging
  - `remediationAgent` for deterministic action routing and payload creation
- **Explainability UI**
  - policy decisions, approval requests, risk exceptions pages

## Architecture overview

Core components:

- **Web + APIs:** `src/app` (Next.js App Router)
- **Orchestration:** `src/inngest/functions` (scan + scheduled functions)
- **Decisioning layer:** `src/lib/decisionEngine.ts`, `src/lib/policyEvaluationService.ts`, `src/lib/policyPrecedence.ts`
- **Agent hooks:** `src/lib/complianceAgent.ts`, `src/lib/remediationAgent.ts`
- **Data layer:** Supabase/Postgres migrations in `supabase/migrations`
- **Access:** Supabase Auth + `tenant_users` roles; enterprise SSO/SCIM notes: `docs/SSO-SCIM-SETUP.md`
- **Tenant roster API:** `GET /api/tenant-users?tenantId=…` (owner|admin) lists membership; SCIM discovery: `GET /api/scim/v2/ServiceProviderConfig`
- **ITSM:** Jira and ServiceNow issue create APIs under `/api/integrations/jira/issues` and `/api/integrations/servicenow/incidents` (ConnectWise: `/api/integrations/connectwise/tickets`); see `docs/ITSM-INTEGRATIONS.md`

Primary v4 workflow:

1. `securewatch/scan.requested` event is sent.
2. `scan-tenant` function creates run, executes scanner, stores findings.
3. For each finding:
   - builds `decision_input`
   - evaluates decision engine
   - stores `policy_decisions` row
   - updates finding `decision_result` / approval / exception status
4. Compliance hook runs after decisioning.
5. Remediation candidates are routed through remediation hook.
6. Incident response playbooks are auto-generated for medium/high/critical findings.
   - containment path includes offline isolation + quarantine VLAN
   - remediation path includes patch/fix and reimage when trust cannot be restored
   - recovery path requires clean validation before rejoin
   - optional human-in-the-loop gate is supported
7. Approval requests are created where needed.
8. Dynamic awareness training recommendations are derived from finding patterns and tenant/real-world signals.
9. Evidence records are generated for eligible outcomes.

Incident lifecycle transitions are managed by a strict state machine endpoint:

- `POST /api/incidents/{incidentEvidenceRecordId}/transition`
- allowed transitions:
  - `open -> contained -> remediated -> validated -> rejoined`
- validation gate:
  - transition to `validated` requires:
    - `postRemediationScanClean=true`
    - `policyChecksPassed=true`
    - finding status `resolved`
    - latest remediation action completed
  - transition to `rejoined` requires prior successful validation attestation
- each successful transition writes audit events and updates incident payload state/history

Incident operations APIs:

- `GET /api/incidents?tenantId=<uuid>&state=<optional>&limit=<optional>`
  - list incident response records with normalized state
- `GET /api/incidents/{incidentEvidenceRecordId}`
  - incident detail with lifecycle, transition history, and computed `rejoinReady` signal

Remediation execution worker endpoint:

- `POST /api/remediation-actions/{id}/execute`
- marks remediation execution `running -> completed`
- stores `execution_result` with performed/simulated steps
- supports command-backed adapters via env commands for isolate/VLAN/patch/reimage/default actions
- enforces allowed start states (`approved`, `queued`, or forced `pending`)
- emits `securewatch/remediation.execution.completed` for workflow fan-out

Post-remediation revalidation workflow:

- on remediation execution completion, automatically resolves original scan target
- triggers a new `securewatch/scan.requested` event as `post_remediation` revalidation
- writes audit logs for queued/skipped revalidation outcomes

Approval-execution linkage:

- approving `remediation_execution` requests now updates linked remediation action to executable state
  (`approval_status=approved`, `execution_status=approved`, `action_status=approved`)
- rejecting `remediation_execution` requests now cancels linked remediation execution
  (`approval_status=rejected`, `execution_status=cancelled`, `action_status=rejected`)
- non-manual approved remediation actions automatically emit execution request events
  and run through an Inngest remediation executor workflow

Automatic incident progression on clean resolution:

- when a finding transitions to `resolved`, incident state can auto-progress
  - `remediated -> validated -> rejoined` (or `validated -> rejoined`)
- requires completed remediation action linkage
- records incident auto-progression and lifecycle audit events

Awareness signal ingestion endpoint:

- `POST /api/awareness/signals/ingest`
- stores real-world/company security signals as evidence rows (`evidence_type=awareness_signal`)
- signals are automatically consumed by scan workflow training-plan generation
- scheduled `awareness-signals-refresh` runs every 6 hours to auto-ingest signals for configured tenants

Awareness training dispatch endpoint:

- `POST /api/awareness/training/dispatch`
- reads latest completed scan run's `awarenessTrainingPlan`
- creates per-topic dispatch evidence rows (`evidence_type=awareness_training_dispatch`)
- records auditable dispatch event for delivery channels (`email`, `slack`, `lms`)

## Why decisioning is centralized

Decisioning is centralized in `evaluateDecision()` so policy behavior is not duplicated across:

- API routes
- workflows
- future background jobs
- future execution workers

Benefits in practice:

- one place to switch provider (`rules` vs `opa`)
- one place to apply precedence/merge behavior
- one consistent shape for `decision_input` and `decision_result`
- easier auditability (`policy_decisions` rows line up with one engine path)

## How policy-as-code fits in

Policy-as-code in v4 has two parts:

1. **Database policy registry**
   - `policies` stores policy source and metadata (including Rego text)
   - `policy_bindings` declares where policies apply
2. **Runtime evaluation path**
   - fallback deterministic rules are always available
   - optional OPA-compatible endpoint can participate in evaluation
   - fallback + OPA outputs are merged by precedence rules

Framework coverage currently includes:

- `soc2`, `cmmc`, `hipaa`, `nist`, `iso27001`, `pci_dss`, `cis`, `gdpr`, `fedramp`, `ccpa`, `cobit`

Deployment-aware policy catalog endpoint:

- `GET /api/policy/catalog?tenantId=<uuid>&framework=<optional>`
- returns framework profiles and control entries with Terraform/Ansible deployment metadata

Policy pack IaC export (for pipelines or `api_mw_connector`):

- `GET /api/policy/export/terraform?tenantId=<uuid>&framework=<optional>&download=1`
  - returns generated `module` blocks pointing at catalog `terraform_module` paths
- `GET /api/policy/export/ansible?tenantId=<uuid>&framework=<optional>&download=1`
  - returns a playbook skeleton listing catalog `ansible_role` entries
- `GET /api/policy/export/manifest?tenantId=<uuid>&framework=<optional>&download=1`
  - returns JSON manifest (`securewatch360.policy_pack_manifest`) for integration layers

Machine auth for catalog + exports (optional, for `api_mw_connector`):

- set `POLICY_PACK_EXPORT_TOKEN` and `POLICY_PACK_EXPORT_TENANT_IDS` (comma-separated tenant UUID allowlist)
- call with `Authorization: Bearer <POLICY_PACK_EXPORT_TOKEN>` and a permitted `tenantId`
- see `docs/API-MW-CONNECTOR.md`

Validate policy pack data locally (DB + migrations, no HTTP server):

```bash
npm run qa:policy-pack
```

CVE catalog and linkage:

- scanner findings now auto-extract CVE identifiers into:
  - `cve_catalog` (global CVE metadata)
  - `finding_cves` (tenant finding-to-CVE links)
- `GET /api/cves?tenantId=<uuid>&cveId=<optional>&limit=<optional>`
  - returns tenant CVE links with scanner/package/version context
- `POST /api/cves/enrich` with `{ "tenantId", "limit?", "forceAll?" }` (analyst+)
  - loads CISA KEV and FIRST EPSS (rate-limited) into `cve_catalog` (`kev_cisa`, `epss_percentile`, `priority_tier`, `enriched_at`)

Notes:

- provider selection uses `DECISION_ENGINE_PROVIDER` (`rules` default, `opa` optional)
- OPA integration expects an OPA-compatible HTTP endpoint via `OPA_POLICY_EVAL_URL`
- if OPA path fails, v4 currently fails open to fallback rules; on hard provider errors, `evaluateDecision` tags fallback output with `sw360_decision_engine_*` metadata
- per-adapter execution hooks: `REMEDIATION_EXEC_{ADAPTERKEY}_{STEP}_COMMAND` (e.g. `REMEDIATION_EXEC_ANSIBLE_PATCH_COMMAND`) with legacy `REMEDIATION_EXEC_*_COMMAND` still supported; see `docs/RISKS-AND-MITIGATIONS.md`

## Approvals and risk exceptions

### Approvals

- Generated from decision outputs requiring approval.
- Stored in `approval_requests`.
- Approval APIs support create/list/approve/reject flows.
- Approval decisions are auditable and linked to finding/remediation entities.
- SLA: `sla_due_at` / `sla_first_reminder_at` set on create from `APPROVAL_DEFAULT_SLA_HOURS` (default 72). Hourly Inngest `approval-risk-sla-sweep` sets `sla_breached_at` for pending items past due.

### Risk exceptions

- Used when risk acceptance is requested/needed.
- Stored in `risk_exceptions`.
- Tracks justification, status lifecycle, optional expiration.
- Finding `exception_status` is updated to keep triage state aligned.
- Review SLA: `review_sla_due_at` on create from `RISK_EXCEPTION_REVIEW_SLA_HOURS` (default 168). Same scheduled sweep can mark `sla_breached_at` for `requested` rows past review due.

## Logical agents in v4

These are code modules, not LLM runtime dependencies.

- **Decisioning Agent (logical)**
  - implemented by `decisionEngine` + policy services
  - computes `DecisionOutput` from normalized input
- **Compliance Agent**
  - maps categories to controls/frameworks
  - writes compliance impact/context
  - can create compliance evidence records
- **Remediation Agent**
  - rules-based route from decision -> action type
  - builds `execution_payload`
  - assigns execution mode/status
  - creates/updates remediation action rows

## Local setup

1. Install dependencies

```bash
npm install
```

1. Create env file (example name can vary by your setup)

```bash
cp .env.local.example .env.local
```

1. Set required environment variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Decision engine provider (optional; default is rules)
DECISION_ENGINE_PROVIDER=rules

# OPA-compatible policy evaluation endpoint (optional)
OPA_POLICY_EVAL_URL=
OPA_POLICY_EVAL_TOKEN=
OPA_POLICY_EVAL_TIMEOUT_MS=4000

# Remediation execution safety
# true (default): require human approval for high-risk actions (e.g. isolate/config change)
# false: allow fully automated execution where guardrails/policy permit
REMEDIATION_HUMAN_IN_THE_LOOP=true

# Optional command adapters for execution worker (supports placeholders:
# {{target}}, {{tenantId}}, {{findingId}}, {{actionType}})
REMEDIATION_EXEC_ISOLATE_COMMAND=
REMEDIATION_EXEC_VLAN_COMMAND=
REMEDIATION_EXEC_PATCH_COMMAND=
REMEDIATION_EXEC_REIMAGE_COMMAND=
REMEDIATION_EXEC_DEFAULT_COMMAND=

# Optional comma-separated threat intel/training signals to shape awareness training output.
SECURITY_AWARENESS_REAL_WORLD_SIGNALS=
SECURITY_AWARENESS_COMPANY_SIGNALS=

# Comma-separated tenant IDs for scheduled awareness signal hydration.
AWARENESS_SIGNAL_TENANT_IDS=

# Optional external feeds (JSON array or { "signals": [] }).
AWARENESS_REAL_WORLD_SIGNALS_URL=
AWARENESS_COMPANY_SIGNALS_URL=
```

1. Apply migrations

```bash
supabase db push
```

1. Run app + Inngest dev server

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run inngest:dev
```

If Next.js runs on a non-default port, set the Inngest app URL before starting:

```bash
INNGEST_APP_URL=http://localhost:3001/api/inngest npm run inngest:dev
```

## Run OPA locally for development

v4 supports OPA through an OPA-compatible HTTP endpoint. You can still run vanilla OPA locally to author/test Rego policies.

Start OPA with local policy files:

```bash
docker run --rm -p 8181:8181 -v "$PWD/policies/rego:/policies" openpolicyagent/opa:latest run --server --addr :8181 /policies
```

Test a policy directly:

```bash
curl -s -X POST "http://localhost:8181/v1/data/securewatch/policy/auto_remediation_eligibility/decision" \
  -H "Content-Type: application/json" \
  -d '{"input":{"severity":"critical","exposure":"internet","targetType":"container_image"}}'
```

Important: current app integration expects `OPA_POLICY_EVAL_URL` to accept a payload like:

```json
{ "input": { ... }, "policies": [ ... ] }
```

So for end-to-end OPA provider mode in-app, point `OPA_POLICY_EVAL_URL` to an endpoint that is OPA-compatible with that contract.

## Seed and QA scripts

### Seed v4 data

Seeds one tenant, sample policies, policy bindings, scan targets, and optional sample finding/remediation.

```bash
npm run seed:v4
```

Optional without finding/remediation:

```bash
npx tsx scripts/seed-v4.ts --no-sample-finding
```

### Run v4 end-to-end QA

Runs workflow trigger + artifact assertions for v4 decisioning/remediation behavior.

Required env for QA:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INNGEST_EVENT_KEY`
- `TEST_TENANT_ID`

Run:

```bash
npm run qa:v4:e2e
```

Optional tuning:

- `QA_MAX_ATTEMPTS` (default `20`)
- `QA_POLL_INTERVAL_MS` (default `3000`)

### Run v4 chaos QA (monkey testing)

Chaos test randomly triggers scans and monitoring alerts across repeated iterations, then fails if any iteration fails or stale running scan runs are detected.

```bash
npm run qa:v4:chaos
```

Optional tuning:

- `CHAOS_ITERATIONS` (default `12`)
- `CHAOS_POLL_ATTEMPTS` (default `40`)
- `CHAOS_POLL_INTERVAL_MS` (default `3000`)
- `CHAOS_CREATION_ATTEMPTS` (default `30`) - wait attempts for scan run creation after trigger
- `CHAOS_CREATION_INTERVAL_MS` (default `1000`)
- `CHAOS_STALE_MINUTES` (default `10`)
- `CHAOS_TARGETS` (comma-separated targets; defaults to `QA_TARGET_URL` or `https://example.com`)

## Known limitations

- Not all routes/pages are fully role-hardened and standardized yet.
- RLS policy model is not fully documented/enforced end-to-end.
- OPA integration is adapter-style; raw OPA endpoint contract mapping is still minimal.
- Scanner adapters are still in staged maturity (some paths use mock fallback).
- Approval and exception flows are functional but still basic in assignment/escalation depth.
- Execution adapters (Ansible/cloud/ticket systems) are payload-ready, not fully connected.
- Pagination and query limits are still inconsistent in some list endpoints.

## Next recommended steps

1. Finalize RLS and tenant isolation policies across all exposed tables.
2. Add a first-class OPA adapter endpoint for `OPA_POLICY_EVAL_URL` contract parity.
3. Add execution workers that consume remediation `execution_payload`.
4. Harden approval assignment and escalation policies (SLA, reminders, ownership).
5. Add integration tests for each decision branch (`auto_remediate`, `approval`, `monitor_only`, `risk_acceptance`).
6. Add dashboard counters and runbooks for policy decision drift and hook failures.
