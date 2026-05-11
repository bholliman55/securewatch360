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
  - optional asset context: `ownerEmail` and `businessCriticality` on `DecisionInput` (from `scan_targets` when set); update with `PUT` or `PATCH` `/api/scan-targets` and JSON body `{ "id", "tenantId", "ownerEmail"?, "businessCriticality"? }` (at least one of the last two)
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

## Notifications (MVP hub)

- **Data:** `notification_subscription_rules` (tenant-wide when `user_id` is null, per-user when set); RLS policies align with `tenant_users` membership.
- **APIs:** `GET` / `POST` `/api/notification-subscriptions?tenantId=…` (optional `scope=all|tenant|user` on GET); `PATCH` `/api/notification-subscriptions/{id}` (body includes `tenantId`). Fields: `minSeverity` (`info`–`critical`), `channel` (`email` | `slack` | `in_app`), `digestInterval` (`off` | `hourly` | `daily` | `weekly`), `scope` on create (`tenant` | `user`).
- **Inngest:** `notification-digest` (hourly cron) writes audit + a stub `evidence_records` row per eligible rule when a digest would be sent; email/Slack are optional follow-ups.
- **Env:** no additional variables for the stub path.

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

Org policy Markdown stubs (per catalog control) and generator: `docs/compliance/TEMPLATES.md`, `npm run generate:compliance-templates:all`. Migration `20260428120000_sync_policy_catalog_to_control_requirements.sql` copies `policy_framework_controls` into `control_requirements` so `complianceAgent` can resolve control UUIDs for mappings.

Compliance posture (aggregated mapped findings vs control catalog):

- `GET /api/compliance/posture?tenantId=<uuid>&framework=<optional>&includeStored=<optional>`
  - returns live `summary` (pass/fail control counts, open mapping links, distinct open mapped findings)
  - set `includeStored=true` to include the latest `tenant_compliance_posture` snapshot and `driftFromStored` deltas (after migration `20260427100000_tenant_compliance_posture.sql`)
- daily Inngest cron `compliance-posture-daily` (07:00 UTC) upserts per-tenant snapshots for `__ALL__` and each `control_frameworks.framework_code`

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
- **Auditor evidence export:** `GET` or `POST /api/evidence/export` with `tenantId` and `start` / `end` (ISO-8601; range ≤ 366 days) — **owner|admin|analyst**; returns a single `application/json` document with a dated sample of `policy_decisions` and filtered `risk_exceptions`, `approval_requests`, and `audit_logs` (each section obeys row caps; see `truncated` in the `export` metadata). A future version may add `application/zip` of per-table JSON and/or a PDF report using the same payload as input—no server-side PDF engine in the MVP.

Notes:

- provider selection uses `DECISION_ENGINE_PROVIDER` (`rules` default, `opa` optional)
- OPA integration expects an OPA-compatible HTTP endpoint via `OPA_POLICY_EVAL_URL`
- if `OPA_POLICY_EVAL_URL` is set but the OPA HTTP call fails (network, timeout, non-2xx) or the body is not a valid decision, evaluation uses engine `fallback` and sets metadata `sw360_opa_unavailable` / `sw360_opa_endpoint_error` (and `sw360_opa_error_message`). By default the **decision** still follows in-repo rules (fail-open to rules). Set `OPA_FAIL_ON_ENDPOINT_ERROR=true` for **fail-closed** behavior: **`escalate`** with **`requiresApproval: true`**, `autoRemediationAllowed: false`, `riskAcceptanceAllowed: false`, reason `opa_endpoint_unavailable`, plus `sw360_opa_fail_closed: true` in metadata (we use **escalate** rather than **block** so degraded policy service surfaces human review without a hard deny on the action enum). On hard **provider** errors outside this path, `evaluateDecision` may still tag output with `sw360_decision_engine_*` metadata
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

# OPA base URL (optional for local dev; default http://localhost:8181)
OPA_BASE_URL=http://localhost:8181
# OPA decision path (defaults to /v1/data/securewatch/v4/decision)
OPA_POLICY_PATH=
# Legacy OPA-compatible policy evaluation endpoint (optional; adapter path)
OPA_POLICY_EVAL_URL=
OPA_POLICY_EVAL_TOKEN=
OPA_POLICY_EVAL_TIMEOUT_MS=4000
# When OPA URL is set: if true/1, OPA transport/HTTP/parse failures return escalate + approval (fail-closed); default false keeps rules fallback decision with OPA error metadata
OPA_FAIL_ON_ENDPOINT_ERROR=

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

Proton Pass option (recommended for local secret handling on shared machines):

- keep placeholders in `.env.local.example`
- create `.env.protonrefs.local` from `.env.protonrefs.local.example`
- run `pwsh ./scripts/dev-with-proton-pass.ps1`
- see `docs/SECRETS-PROTON-PASS.md`

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

v4 can call local OPA directly via `OPA_BASE_URL` and policy path `OPA_POLICY_PATH` (default `/v1/data/securewatch/v4/decision`).

Quick start command:

```bash
docker run -p 8181:8181 openpolicyagent/opa run --server --addr :8181
```

Start OPA with local policy files mounted (recommended):

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

For local OPA setup and troubleshooting details, see `docs/OPA-LOCAL-DEV.md`.

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

Policy Rego in the seed is loaded from `policies/rego/seed/*.rego` (edit files, re-run `npm run seed:v4`).

### Posture Roadmap demo data (Acme Precision Manufacturing)

Seeds a realistic investor-walkthrough scenario: Acme Precision Manufacturing, CMMC L2 target, maturity score 42, 6 framework readiness scores, 10 posture gaps, and 13 roadmap action items across Fix First / Next 30 / 60 / 90 Days buckets.

**Seed demo data:**

```bash
npm run seed:posture-roadmap-demo
```

The script auto-creates an "Acme Precision Manufacturing" tenant if none exists, or finds any tenant whose name contains "acme" or "demo". Pass `--tenant <uuid>` to target a specific tenant:

```bash
node scripts/seed-posture-roadmap-demo.mjs --tenant <uuid>
```

**Reset and re-seed:**

```bash
npm run reset:posture-roadmap-demo   # clears all posture roadmap tables for the Acme tenant
npm run seed:posture-roadmap-demo    # re-seeds fresh demo data
```

The reset script deletes in FK-safe order (`posture_roadmap_action_items` → `posture_gaps` → `framework_readiness_scores` → `posture_score_history` → `posture_assessments` → `posture_roadmap_items` → `posture_target_config`) without removing the tenant record.

Both scripts require `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in env (service role bypasses RLS — local/CI use only).

**View the demo:** navigate to `/posture-roadmap?tenantId=<uuid>` with the seeded tenant ID.

### Policy pack + IaC + Rego validation

Validates the **framework catalog** SQL export shape (`npm run qa:policy-pack`), the **in-repo reference pack** under `iac/securewatch360-policy-pack/` (Terraform + Ansible), and **OPA syntax** for `policies/rego/**` when the CLIs are installed.

```bash
npm run qa:policy-pack
npm run qa:iac
npm run qa:rego
# or all three:
npm run qa:policy-qa
```

- **Terraform / Ansible:** install Terraform 1.5+ and Ansible. In CI, set `CI=true` (or `REQUIRE_TERRAFORM_ANSIBLE=1`) so missing binaries fail the run.
- **OPA:** install the `opa` CLI; set `CI=true` or `REQUIRE_OPA=1` to require it.
- The reference modules under `iac/securewatch360-policy-pack/terraform/modules/policies/` match **NIST** paths used in `policy_framework_controls` (e.g. `modules/policies/nist_gv_po_01`). The full catalog points at the same **path convention**; replace stubs with your registry modules in a consuming repo.

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

## Security testing baseline (OWASP ZAP + Snyk + infra + OSINT)

Security testing guidance and commands live in:

- `docs/SECURITY-TESTING-PLAYBOOK.md`

Recommended minimum weekly cadence:

1. SCA: `snyk test` (or `npm audit` fallback)
2. SAST: `semgrep` OWASP + secrets rules
3. Infra/config/secrets: `trivy fs`
4. DAST: `scripts/zap-baseline.cmd` against local/staging
5. OSINT/attack surface: Amass + theHarvester + nuclei on approved domains only

GitHub Actions workflow:

- `.github/workflows/security-scans.yml`
- PRs to `develop`: SCA + SAST + infra scans
- Nightly/manual: ZAP DAST + OSINT surface scan

Required repository secrets for scheduled/manual scans:

- `ZAP_TARGET_URL` (staging URL for DAST)
- `OSINT_PRIMARY_DOMAIN` (approved domain for passive OSINT/surface checks)

## Known limitations

- Not all routes/pages are fully role-hardened and standardized yet.
- RLS policy model is not fully documented/enforced end-to-end.
- OPA integration is adapter-style; raw OPA endpoint contract mapping is still minimal.
- Scanner adapters are still in staged maturity (some paths use mock fallback).
- Approval and exception flows are functional but still basic in assignment/escalation depth.
- Execution adapters (Ansible/cloud/ticket systems) are payload-ready, not fully connected.
- Pagination and query limits are still inconsistent in some list endpoints.

## Next recommended steps

---

## Bright Data External Intelligence Layer

> **Agentless external intelligence + low-friction internal visibility.**

Bright Data helps SecureWatch360 collect external, web-accessible intelligence at scale. It does not replace authenticated internal telemetry, endpoint data, private network scanning, or customer-authorized API integrations.

### What it does

The external intelligence layer adds two passive, non-intrusive collection agents that run asynchronously via Inngest, persist findings to Supabase, and surface results through a clean UI. Only public, web-accessible signals are collected — no active port scanning, no authenticated probing, no credential retrieval.

### Why Bright Data

Bright Data provides a managed proxy and browser automation infrastructure that enables:

- Reliable public web fetching behind bot-detection layers
- SERP API access for search-driven OSINT
- Certificate Transparency log queries
- Browser automation for JS-heavy pages (wired, ready to activate)

### Agent 1 — External Attack Surface Discovery

Discovers what an attacker can see about a target domain from the public internet:

| Signal | Source |
|--------|--------|
| Subdomains | SERP search operators, CT log search |
| Certificate entries | crt.sh JSON API |
| Login pages & admin portals | SERP endpoint enumeration |
| Public URLs | robots.txt, sitemap.xml, SERP |
| Technology fingerprints | HTTP headers (wired placeholder) |

Trigger: `securewatch/agent1.external_discovery.requested`
Results: persisted to `external_assets` table

### Agent 2 — OSINT & Threat Intelligence Collection

Collects external threat signals without retrieving or storing raw credentials:

| Signal | Source |
|--------|--------|
| Credential exposure metadata | Paste sites, breach indexes |
| Breach references | HIBP-style sources, SERP |
| Exploit chatter | Exploit-DB, NVD, SERP |
| Vulnerability mentions | Security advisories, SERP |
| Vendor security signals | GitHub advisories, NVD |

**Compliance:** raw passwords are never fetched or stored. Only metadata (email/domain involved, source category, exposure type, confidence, redacted preview) is persisted.

Scoring: `LOW → MEDIUM → HIGH → CRITICAL` based on event type, confidence, and keywords (admin/executive credential exposure or active exploit = CRITICAL).

Trigger: `securewatch/agent2.osint_collection.requested`
Results: persisted to `external_intelligence_events` table

### What it does NOT do

- Does not scan internal networks, private IPs, or `.local` / `.internal` domains
- Does not perform active port scanning or service fingerprinting
- Does not retrieve, store, or display raw passwords or secrets
- Does not replace endpoint agents, SIEM integrations, or authenticated API connectors

### Internal visibility options

For internal network visibility, SecureWatch360 supports:
- **Tenable integration** — authenticated vulnerability scan ingestion via `/api/integrations/tenable`
- **Semgrep SAST** — code-level security findings via CI/CD
- **Custom scan targets** — add assets at `/api/scan-targets` and run scheduled scans via Inngest
- **Optional SecureWatch360 runner** — a lightweight agent installable on internal infrastructure for authenticated telemetry (roadmap)

### Required environment variables

```
BRIGHTDATA_API_KEY=
BRIGHTDATA_WEB_UNLOCKER_ZONE=
BRIGHTDATA_SERP_ZONE=
BRIGHTDATA_BROWSER_ZONE=
```

### Running a scan

**Via Console UI (`/console`)**
- Tenant context is auto-selected from the authenticated user's highest role (`owner > admin > analyst > viewer`).
- If a user has no explicit tenant memberships in local demo mode, UI falls back to `VITE_TEST_TENANT_ID` (or the default seeded test tenant ID).
- `New scan` now supports:
  - **External intelligence workflow**: domain/URL/public-IP input that triggers Agent 1 + Agent 2 through `/api/security/external-intelligence/run`
  - **Standard workflow**: scan target creation + `/api/scans/request` dispatch
  - External target validation blocks localhost, private/internal domains, and private/reserved IPv4 ranges while permitting public IPv4 targets

**Via API:**
```bash
POST /api/security/external-intelligence/run
{
  "tenantId": "<tenant-uuid>",
  "domain": "example.com",
  "companyName": "Example Corp",
  "runAgent1": true,
  "runAgent2": true
}
```

**Via QA script (dry-run):**
```bash
npm run qa:external-intel -- example.com
npm run qa:external-intel -- example.com --persist
```

---

## Feature Layer (v5+)

These capabilities were added on top of the v4 platform. Each is independently usable.

### Feature 2 — SSE Live Findings Feed

Real-time browser push when findings land or change. Bridges Supabase Realtime to `EventSource`.

- **API:** `GET /api/events/findings` — SSE stream, 25s heartbeat
- **Hook:** `src/hooks/useLiveFindings.ts` — exponential backoff reconnect
- **Component:** `src/components/LiveFindingsFeed.tsx`

### Feature 3 — Vendor Risk Assessment

Third-party vendor risk scoring using external intelligence signals.

- **API:** `GET /api/security/vendor-risk` · `POST /api/security/vendor-risk` (triggers scan)
- **Inngest:** `securewatch/vendor_risk.assessment.requested`
- **Tables:** `vendor_assessments`, `vendor_risk_signals`
- **Component:** `src/components/vendor-risk/VendorRiskCard.tsx`

### Feature 4 — AI-Generated Remediation Playbooks

Claude Haiku generates step-by-step remediation playbooks on demand and stores them on the remediation action.

- **API:** `GET /api/remediation-actions/:id/playbook` · `POST` (triggers Inngest)
- **Inngest:** `securewatch/remediation.playbook.requested`
- **Component:** `src/components/remediation/PlaybookPanel.tsx` — polls until ready

### Feature 5 — Compliance Evidence Package Export

One-click export of a compliance evidence package (HTML report or JSON) covering posture, findings, evidence records, and audit log.

- **API:** `GET /api/compliance/evidence-export?framework=NIST&format=html|json`
- **API:** `GET /api/compliance/evidence-export/manifest` — active frameworks for tenant
- **Component:** `src/components/compliance/EvidenceExportButton.tsx`

### Feature 6 — Risk Acceptance Workflow UI

Full review/approve/reject UI for risk exception requests with SLA-aware queue.

- **Page:** `/risk-exceptions`
- **Components:** `RiskExceptionForm`, `RiskExceptionCard`, `RiskExceptionQueue`
- Approve/reject inline; rejection requires reason text

### Feature 7 — Multi-Framework Gap Analysis

Side-by-side compliance score heatmap across all 11 frameworks.

- **API:** `GET /api/compliance/gap-analysis`
- **Page:** `/compliance/gap-analysis`
- **Component:** `src/components/compliance/GapAnalysisHeatmap.tsx`

### Feature 8 — AI Threat Digest

Claude Haiku generates a weekly AI security briefing: top findings, vendor risk changes, recommended action.

- **API:** `GET /api/threat-digest` · `POST` (on-demand trigger)
- **Inngest:** cron Monday 08:00 UTC + `securewatch/threat.digest.requested`
- **Table:** `tenant_threat_digests`
- **Component:** `src/components/ThreatDigestCard.tsx`

### Feature 9 — Asset Inventory

Asset catalog built from findings, grouped by asset type with finding severity counts.

- **API:** `GET /api/assets?type=...` · `POST /api/assets` (rebuild from findings)
- **Page:** `/assets`
- **Table:** `asset_inventory`
- **Component:** `src/components/assets/AssetInventoryTable.tsx`

### Feature 10 — SLA Breach Alerting

Hourly Inngest sweep that emits `securewatch/sla.breach.warning` (4h before) and `securewatch/sla.breach.violated` for pending approvals and risk exceptions past SLA.

- **Inngest:** `sla-breach-sweep` (hourly cron)
- Writes `sla_breached_at` on first violation

### Feature 11 — Incident War Room

Collaborative incident response view: status transitions, scrollable audit timeline, and analyst note posting.

- **API:** `GET /api/incidents/:id/timeline` · `POST` (add note)
- **Component:** `src/components/incidents/IncidentWarRoom.tsx`
- Transitions: `open → contained → remediated → validated → rejoined`

### Feature 12 — Policy Simulation Mode

Test policy rule changes against up to 100 historical decisions before applying them. Read-only — nothing is written.

- **API:** `POST /api/policy/simulate` — body: `{ overrides: {...}, sampleSize: 30 }`
- Returns `changeRate`, `actionFlips` breakdown
- **Component:** `src/components/policy/PolicySimulator.tsx`
- Restricted to `owner` / `admin` roles

### Feature 13 — Scheduled Report Builder

Automated evidence package exports on configurable cron schedules.

- **API:** `GET /api/scheduled-reports` · `POST` (create schedule)
- **Inngest:** `run-scheduled-reports` (hourly check, runs due reports)
- **Table:** `scheduled_reports`
- **Component:** `src/components/reports/ScheduledReportBuilder.tsx`

### Feature 14 — Integration Hub (Jira / ServiceNow)

Bidirectional sync: push remediation actions to Jira or ServiceNow; store external ticket references.

- **API:** `GET/POST /api/integrations/configs` — configure connector credentials
- **API:** `POST /api/integrations/sync` — push a remediation action to external ticketing
- **Tables:** `integration_configs`, `integration_sync_records`
- **Lib:** `src/lib/integrationHub.ts`

### Feature 15 — Tenant Onboarding Wizard
5-step guided setup: scan targets → compliance frameworks → team invite → first scan → done.
- **Page:** `/onboarding`
- **Component:** `src/components/onboarding/OnboardingWizard.tsx`

---

## Posture Roadmap

> **From visibility to remediation in one screen — scored posture, framework readiness, gap analysis, and a prioritized 90-day action plan.**

### What it does

The Posture Roadmap feature gives CTOs, IT Directors, and Security Officers a single view of:

1. **Current State** — overall maturity score (0–100), key risk findings, and readiness percentage across six compliance frameworks (CMMC L1/L2, CIS, NIST, HIPAA, SOC 2).
2. **Target State** — the selected framework's certification threshold, control coverage, and the exact gaps blocking readiness.
3. **Gap Analysis** — every unaddressed control gap grouped by security domain, sorted by severity, with expandable detail (current state → desired state → recommended action).
4. **Roadmap** — a prioritized action plan bucketed into Fix First / Next 30 / 60 / 90 days, with effort estimates, impact scores, and automation availability.

Each roadmap item is tagged with an **automation level**:
- `Automate Now` — SecureWatch360 Identity / Endpoint / Backup / Vulnerability agents can remediate immediately.
- `Automate Later` — automation support is planned; manual action required in the interim.
- `Manual` — requires policy, process, or training changes with no automated path.

### Architecture

```
Client (Next.js SSR page)
  └─ /posture-roadmap/page.tsx          Server Component — fetches summary + roadmap items
       └─ PostureRoadmapClient.tsx       Client Component — tab navigation, framework switcher, modals

Service layer
  src/features/posture-roadmap/services/
    postureScoringService.ts            Pure scoring engine — calculateOverallPostureScore,
                                        calculateFrameworkReadiness, generatePostureGaps,
                                        generateRoadmapItems
    postureDataAdapter.ts               Transforms Supabase live data → PostureScoringInput
    postureRoadmapService.ts            Orchestration — read/write/generate assessment lifecycle

src/lib/postureRoadmapService.ts        Legacy lib-layer service (computeCurrentState,
                                        computeTargetState, getPostureRoadmapSummary)
                                        Used by summary and roadmap API routes.

API routes
  GET  /api/posture-roadmap/summary     Full posture summary (current state, target, gaps, counts)
  POST /api/posture-roadmap/assessment  Trigger full assessment pipeline → persist to DB
  GET  /api/posture-roadmap/roadmap     List roadmap items (filterable by status/priority/category)
  PATCH /api/posture-roadmap/roadmap/[id]  Update item status or priority
  GET  /api/posture-roadmap/target      Get current target framework
  PATCH /api/posture-roadmap/target     Set target framework

Supabase tables (see migrations below)
  posture_assessments                   Assessment snapshots
  framework_readiness_scores            Per-framework readiness breakdown
  posture_gaps                          Gap records with severity and evidence links
  posture_roadmap_action_items          Prioritized action items with automation metadata
  posture_score_history                 Score over time per framework
  posture_target_config                 Per-tenant target framework setting
  posture_roadmap_items                 Simple tenant-scoped roadmap items (pre-assessment)

Inngest
  compliance-posture-daily.ts           Nightly cron that re-scores all tenants with assessments
```

### Category weights (scoring engine)

| Category | Weight | Key inputs |
|---|---|---|
| Identity & Access | 20% | MFA %, privileged MFA %, RBAC |
| Endpoint Security | 15% | EDR coverage, patch compliance |
| Vulnerability Mgmt | 15% | Open critical/high CVEs, CVSS age |
| Network Security | 10% | Internet-facing exposure, segmentation |
| Backup & Recovery | 10% | Backup configured, immutability, last test |
| Monitoring & Logging | 10% | Centralized logging, SIEM |
| Compliance Evidence | 10% | Controls mapped, evidence coverage |
| Security Awareness | 5% | Training completion, phishing simulation |
| Incident Response | 5% | IRP documented, tabletop completed |

Framework target scores: **CIS 70 · NIST 65 · CMMC L1 60 · CMMC L2 80 · HIPAA 75 · SOC 2 72**

### Database migrations

Three migrations compose the full Posture Roadmap schema. Apply in order:

```bash
# Apply all pending migrations
supabase db push

# Or apply individually (in order):
supabase db push --file supabase/migrations/20260510190000_posture_roadmap.sql
supabase db push --file supabase/migrations/20260510200000_posture_roadmap_extended.sql
supabase db push --file supabase/migrations/20260510210000_posture_roadmap_gap_fill.sql
```

What each migration adds:
- `20260510190000_posture_roadmap.sql` — `posture_roadmap_items`, `posture_target_config`, RLS policies
- `20260510200000_posture_roadmap_extended.sql` — `posture_assessments`, `framework_readiness_scores`, `posture_gaps`, `posture_roadmap_action_items`, `posture_score_history`
- `20260510210000_posture_roadmap_gap_fill.sql` — `is_estimated` flags, `roadmap_bucket` column, view alias, RLS gap-fills

### Seeding demo data

The demo page (`/demo/posture-roadmap`) uses fully static fixtures — no DB required. To seed
the **Acme Precision Manufacturing** tenant into Supabase for end-to-end testing:

```bash
# 1. Ensure migrations are applied
supabase db push

# 2. Run the v4 seed script (includes posture seed data)
npm run seed:v4

# The seed inserts:
#   - Tenant: Acme Precision Manufacturing (tenant_id: e0129f25-ab2c-4a0b-a72b-4cfaef9692b1)
#   - 13 roadmap items across 8 security domains (CMMC L2 target)
#   - Target framework set to CMMC_L2
#   - Posture assessment with overall score 42, 38% CMMC L2 readiness
```

### Resetting demo data

```bash
# Reset posture data for the demo tenant only
npm run seed:v4 -- --reset

# Or via the API endpoint (requires admin role):
curl -X POST /api/demo/reset \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "e0129f25-ab2c-4a0b-a72b-4cfaef9692b1", "scope": "posture"}'

# The demo page at /demo/posture-roadmap uses static fixtures and requires no reset.
```

### Running tests

```bash
# All posture roadmap tests (scoring engine + service layer + UI components)
npx vitest run src/features/posture-roadmap/ src/lib/__tests__/postureScoringService.test.ts

# Full test suite
npm test

# Watch mode (development)
npx vitest

# Coverage for posture scoring service
npx vitest run --coverage src/lib/__tests__/postureScoringService.test.ts
```

Test files:
| File | Tests | What it covers |
|---|---|---|
| `src/lib/__tests__/postureScoringService.test.ts` | 47 | Core scoring engine: `calculateOverallPostureScore`, `calculateFrameworkReadiness`, `generatePostureGaps`, `generateRoadmapItems`, `calculateDistanceToTarget` |
| `src/features/posture-roadmap/services/__tests__/postureScoringService.test.ts` | 34 | `generatePostureAssessment` end-to-end: result shape, correctness, isEstimated propagation, summary text |
| `src/features/posture-roadmap/services/__tests__/postureDataAdapter.test.ts` | 10 | `PostureRoadmapError`, `validateFramework`, `FRAMEWORK_TYPES` constants |
| `src/features/posture-roadmap/services/__tests__/postureRoadmapService.unit.test.ts` | 28 | Service layer: `getLatestPostureAssessment`, `updateRoadmapItemStatus`, `createPostureAssessment` (automation/bucket mapping), `previewAutomationPlan`, `PostureRoadmapError` |
| `src/features/posture-roadmap/__tests__/components.test.tsx` | 31 | UI: `EmptyState`, `GapAnalysisPanel`, `AutomationModal`, `RoadmapPanel` (filters, status dropdown, automation button) |

### Accessing the feature

| URL | Description |
|---|---|
| `/posture-roadmap?tenantId={uuid}` | Live production view — requires valid Supabase tenant ID and authenticated session |
| `/posture-roadmap?tenantId={uuid}&targetFramework=CMMC_L2` | Pre-selects target framework |
| `/demo/posture-roadmap` | Static demo view — no auth, no DB, uses Acme Precision Manufacturing fixtures |
| `/api/posture-roadmap/summary?tenantId={uuid}` | JSON: full posture summary |
| `/api/posture-roadmap/roadmap?tenantId={uuid}` | JSON: roadmap items list |
| `/api/posture-roadmap/assessment` | `POST`: trigger new assessment pipeline |

### Connection to full SecureWatch360 automation

The Posture Roadmap is the **planning layer** above SecureWatch360's remediation automation:

```
Findings (scan_runs → findings)
  └─ Decision Engine (decisionEngine.ts)
       └─ Posture Scoring (postureScoringService.ts)
            └─ Gap → Roadmap Item (priority + automation_level)
                 └─ Automation Modal → /api/posture-roadmap/automate
                      └─ Remediation Agent (remediationAgent.ts)
                           └─ Inngest workflow (patch / isolate / enforce MFA)
                                └─ Audit + Evidence record
```

When a roadmap item is marked **Automate Now** and the user approves:

1. The `AutomationModal` collects the execution mode (`recommend_only` | `assisted_remediation` | `autonomous_remediation`).
2. An approval request is created (`approval_requests` table) with the item context.
3. The remediation agent routes to the appropriate Inngest function based on category and execution mode.
4. On completion, the posture assessment is re-scored and the roadmap item status is updated to `completed`.
5. An evidence record is written to `evidence_records` for the compliance vault.

Human-in-the-loop is controlled by `REMEDIATION_HUMAN_IN_THE_LOOP=true` in `.env.local`.

---

## ElevenLabs Voice Layer

SecureWatch360 includes a deterministic voice operating layer fronted by an ElevenLabs Conversational AI agent. Voice utterances are classified server-side, gated by role + safety policy, optionally challenged for verbal confirmation, and audited end-to-end.

- **Gateway:** `src/server/voice/voiceGateway.ts` — `handleVoiceCommand()` is the single entry point.
- **Webhook:** `src/server/api/elevenlabs/webhook.ts` — accepts ElevenLabs `tool_call` and `post_call_transcription` events, verifies the HMAC signature, and dispatches into the gateway.
- **Outbound calls:** `src/server/voice/outboundIncidentCallService.ts` — `startOutboundIncidentCall()` for critical-severity briefings via ElevenLabs Twilio.
- **UI:** `src/components/voice/VoiceCommandCenter.tsx` (status, examples, pipeline timeline, guardrails panel).
- **Agent prompt:** [`docs/elevenlabs/securewatch360-agent-instructions.md`](docs/elevenlabs/securewatch360-agent-instructions.md).
- **Migration:** `supabase/migrations/20260508130000_create_voice_tables.sql` — adds `voice_sessions`, `voice_commands`, `voice_audit_events`, `voice_confirmation_requests`.

### Required environment variables

Add the following to `.env.local` (or your secret manager). All five are read at request time, so changes do not require a process restart.

```bash
# ElevenLabs Conversational AI agent + outbound Twilio
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
ELEVENLABS_PHONE_NUMBER_ID=

# HMAC secret for inbound webhooks. When set, signature verification is mandatory.
ELEVENLABS_WEBHOOK_SECRET=

# Bypass real outbound calls in dev. Always start in dry-run mode.
VOICE_CALLS_DRY_RUN=true
```

Optional defaults used by the webhook handler when ElevenLabs `dynamic_variables` are missing (development only — production callers MUST send `tenant_id` / `user_id` / `user_role`):

```bash
ELEVENLABS_DEFAULT_TENANT_ID=
ELEVENLABS_DEFAULT_USER_ID=
ELEVENLABS_DEFAULT_USER_ROLE=analyst   # owner | admin | analyst | viewer
```

### Local setup

1. **Add env vars** to `.env.local` (the five required variables above plus any optional defaults).
2. **Run the migration** so the four voice tables exist:

   ```bash
   supabase db push
   ```

3. **Start the dev server** (and the Inngest dev server in a second terminal so adapter-dispatched events run):

   ```bash
   npm run dev
   npm run inngest:dev
   ```

4. **Configure the ElevenLabs webhook URL** in the ElevenLabs agent dashboard. Point post-call and tool-call events at:

   ```text
   https://<your-tunnel-or-host>/api/elevenlabs/webhook
   ```

   Set the same shared secret in the dashboard and in `ELEVENLABS_WEBHOOK_SECRET`. For local dev, use a tunnel (e.g. `cloudflared` or `ngrok`) since ElevenLabs cannot reach `localhost`.

5. **Run the QA harness** to confirm the gateway, classifier, policy guard, confirmation service, and audit pipeline are all healthy without touching ElevenLabs:

   ```bash
   npm run qa:voice
   ```

   The script exits non-zero if any of the six canonical scenarios fails.

6. **Test a read-only command first.** Through the live agent (or via a `tool_call` POST) say:

   > "Show me critical findings for Acme Dental"

   You should hear an answer and see two rows in `voice_audit_events` (`voice.command.received`, `voice.command.executed`). No Inngest event should fire — read-only intents go straight to the data layer.

7. **Test the confirmation flow second.** Say:

   > "Isolate endpoint LAPTOP-123"

   The agent must respond with the canonical confirmation challenge (e.g. *"Say: confirm isolate endpoint LAPTOP-123"*) and `voice_confirmation_requests` must contain a `pending` row with a five-minute TTL. Then say *"Confirm isolate endpoint LAPTOP-123"* — the gateway moves the command to `executed`, dispatches the remediation Inngest event, and writes a `voice.confirmation.accepted` audit row.

### Security notes

- **Do not allow voice commands to bypass RBAC.** The gateway enforces role + safety via `evaluateVoicePolicy`. Tenant + user + role come from `dynamic_variables` (preferred) or env defaults — never from a free-form transcript.
- **Do not expose internal Inngest, Supabase, or workflow secrets.** The agent prompt (`docs/elevenlabs/securewatch360-agent-instructions.md`) explicitly forbids reading API keys, webhook URLs, or service-role tokens aloud, and the gateway response shape carries only `spokenResponse` plus event names — never payloads.
- **Do not execute destructive commands without confirmation.** `ISOLATE_ENDPOINT` and `DISABLE_USER_ACCOUNT` require both an admin role *and* a phrase-matching verbal confirmation; non-admins are denied even if the phrase matches.
- **Log every voice command.** Two audit rows per command are written across both `audit_logs` and `voice_audit_events` — one on receipt, one on resolution. Confirmation challenges add `requested` / `accepted` / `rejected` / `expired` events on top.
- **Keep `VOICE_CALLS_DRY_RUN=true` until production credentials are verified.** Outbound incident calls fall back to synthetic conversation IDs in dry-run mode but still create session + audit rows so the rest of the platform can be exercised end-to-end.

### Troubleshooting

#### Webhook returns 401

The signature did not verify. Check, in this order:

- `ELEVENLABS_WEBHOOK_SECRET` matches the value in the ElevenLabs dashboard exactly (no trailing whitespace).
- The `ElevenLabs-Signature` header is present and shaped `t=<unix>,v0=<hex>`. The handler also enforces a ±30-minute timestamp window to defeat replay; clock skew on the server will read as `timestamp_outside_window`.
- For dev, you may temporarily unset `ELEVENLABS_WEBHOOK_SECRET` to skip verification — the handler will accept the call and audit `signature_verification: "skipped"`. Never ship that to production.

#### Missing transcript ("ignored")

The webhook accepted the payload but found nothing to dispatch. Common causes:

- `data.parameters.transcript` was empty on a `tool_call`. The agent prompt should always pass the user's words into that field.
- A `post_call_transcription` event contained only `agent` turns. The handler aggregates `user`-role turns into the transcript; if the operator never spoke, there is nothing to classify.
- Verify the audit row in `voice_audit_events` — its `event_payload` contains the full safe payload for forensic inspection.

#### ElevenLabs API key invalid

The outbound-call client returns `{ ok: false, reason: "http_error", status: 401 }`. The service writes an `OUTBOUND_INCIDENT_CALL_FAILED` audit row (no API key in the payload). Rotate `ELEVENLABS_API_KEY`, then retry. The thin client (`src/server/voice/elevenlabsClient.ts`) reads env at call time, so no restart is needed.

#### Outbound call disabled

If `startOutboundIncidentCall` returns `{ ok: true, skipped: true, reason: "severity_below_threshold" }`, the severity gate fired (only `critical` calls by default). Pass `force: true` for explicit operator overrides. If it returns `{ ok: false, reason: "missing_agent_config" | "missing_phone_number_config" | "missing_api_key" }`, the corresponding env var is unset; the failure is also written to `audit_logs` with `OUTBOUND_INCIDENT_CALL_FAILED`.

#### Command classified as UNKNOWN

The deterministic classifier could not match the utterance against any intent rule. The gateway returns `status: "needs_clarification"` and the agent should ask one clarifying question. To debug:

- Run `npm run qa:voice` to confirm the canonical phrasings still classify correctly (regression check).
- Check `src/server/voice/voiceIntentClassifier.ts` — every intent has a list of regex patterns and an explicit `reason` string surfaced in the audit payload.
- Add a new pattern when an intent has multiple natural phrasings. All existing patterns are additive, so new phrasings will not affect prior classifications.

---

## Infrastructure as Code

### Application Deployment (Terraform)

Full Terraform modules for provisioning SecureWatch360 in production or staging.

```
iac/terraform/
  modules/
    securewatch360-app/   # Vercel project + env vars
    supabase-project/     # Supabase project + auth config
    secrets/              # AWS Secrets Manager (secrets source-of-truth)
  environments/
    production/main.tf    # Production wiring
    staging/main.tf       # Staging wiring
```

**Apply production:**
```bash
terraform -chdir=iac/terraform/environments/production init
terraform -chdir=iac/terraform/environments/production plan
terraform -chdir=iac/terraform/environments/production apply
```

Required Terraform variables: `supabase_organization_id`, `supabase_db_password`, `supabase_jwt_secret`, `git_repository`, `anthropic_api_key`, `inngest_event_key`, `inngest_signing_key`.

### Policy Pack (multi-framework)

The reference policy pack at `iac/securewatch360-policy-pack/` aligns with the seeded `policy_framework_controls` catalog (currently **995** Ansible roles plus matching Terraform modules under `terraform/modules/policies/<slug>/`). Paths and slugs mirror `ansible_role` and `terraform_module` in the migration `20260425150000_policy_pack_full_catalog.sql`.

Regenerate stubs after changing that migration or `data/policy-catalog/`:

```bash
npm run generate:policy-pack-iac
```

**Apply all policy controls:**
```bash
cd iac/securewatch360-policy-pack/terraform
terraform init && terraform apply -var="enforcement_mode=enforced"
```

**Run all policy controls via Ansible:**
```bash
cd iac/securewatch360-policy-pack/ansible
ansible-playbook playbook-securewatch360-policy-pack.yml -e enforcement_mode=enforced
```

---

1. Finalize RLS and tenant isolation policies across all exposed tables.
2. Add a first-class OPA adapter endpoint for `OPA_POLICY_EVAL_URL` contract parity.
3. Add execution workers that consume remediation `execution_payload`.
4. Harden approval assignment and escalation policies (SLA, reminders, ownership).
5. Add integration tests for each decision branch (`auto_remediate`, `approval`, `monitor_only`, `risk_acceptance`).
6. Add dashboard counters and runbooks for policy decision drift and hook failures.
