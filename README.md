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

**Via API:**
```bash
POST /api/security/external-intelligence/run
{
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

The reference policy pack at `iac/securewatch360-policy-pack/` now covers all 11 compliance frameworks:

| Framework | Modules |
|-----------|---------|
| NIST CSF 2.0 | `nist_gv_po_01`, `nist_id_am_01`, `nist_pr_ds_01` |
| HIPAA | `hipaa_164_308_a_1`, `hipaa_164_308_a_5` |
| PCI-DSS | `pci_dss_req_1`, `pci_dss_req_6` |
| ISO 27001 | `iso27001_a_5_1`, `iso27001_a_8_1` |
| SOC 2 | `soc2_cc6_1`, `soc2_cc7_1` |
| CIS Controls | `cis_csc_1`, `cis_csc_3` |
| GDPR | `gdpr_art_32`, `gdpr_art_33` |
| FedRAMP | `fedramp_ac_2`, `fedramp_au_2` |
| CMMC | `cmmc_ac_l2_3`, `cmmc_ir_l2_3` |
| COBIT | `cobit_apo12`, `cobit_dss05` |
| CCPA | `ccpa_s1798_100`, `ccpa_s1798_105` |

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
