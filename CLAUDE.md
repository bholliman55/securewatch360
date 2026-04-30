# Claude Code — SecureWatch360

## What This Is

SecureWatch360 is a multi-tenant security operations platform (v4). It scans assets, normalizes findings, evaluates them against policy, routes remediation actions, tracks incident lifecycle, and maps everything to compliance frameworks (NIST, HIPAA, PCI-DSS, ISO 27001, SOC 2, CMMC, CIS, GDPR, FedRAMP, CCPA, COBIT). Audit trail and evidence export are first-class.

## Stack

- **Next.js 15** (App Router), **React 19**, **TypeScript 5.9**
- **Supabase** (Postgres + Auth + RLS) — client factories in `src/lib/supabase.ts`
- **Inngest** — event-driven workflow orchestration (`src/inngest/`)
- **OPA** (optional) — external policy evaluation; fail-open by default
- **UI sub-app** — separate Vite + React + Tailwind app in `ui/`, proxies `/api` to Next.js on `:3000`

## Commands

```bash
npm run dev           # Next.js dev server → http://localhost:3000
npm run inngest:dev   # Inngest dev server (run alongside dev)
npm run typecheck     # tsc --noEmit
npm run lint          # next lint
npm run build         # production build

# UI sub-app (separate terminal)
npm run ui:dev        # Vite dev server for ui/

# Database
supabase db push      # apply migrations in supabase/migrations/

# Seeding & QA
npm run seed:v4
npm run qa:v4:e2e
npm run qa:frameworks:operational
```

## Key Directories

```
src/
  app/
    api/          # 51 REST route handlers (App Router)
    analyst/      # analyst dashboard page
    account/      # account/settings page
  lib/            # service layer — all domain logic lives here
  inngest/
    functions/    # 10 event-driven workflows
  scanner/        # scanner adapter layer (mock + Tenable/Semgrep)
  types/          # shared TypeScript domain models
supabase/
  migrations/     # 28+ timestamped SQL migrations
ui/               # Vite React sub-app (served at /console/)
policies/         # OPA Rego policy files
iac/              # Terraform + Ansible reference modules
docs/             # engineering guardrails, ITSM integration docs
scripts/          # QA, seeding, compliance generation scripts
```

## Architecture Patterns

**Service layer** (`src/lib/`) is the source of truth for domain logic — API routes are thin wrappers.

Key services:
- `decisionEngine.ts` — core policy evaluation (rules + optional OPA)
- `policyPrecedence.ts` — merges rule + OPA results; action strength order: `allow < monitor_only < request_risk_acceptance < create_remediation < auto_remediate < escalate < block`
- `remediationAgent.ts` — action routing and execution; deterministic, no LLM for policy decisions
- `complianceAgent.ts` — finding → control mapping across 11 frameworks
- `incidentStateMachine.ts` — strict lifecycle: `open → contained → remediated → validated → rejoined`
- `audit.ts` / `evidence.ts` — audit log and evidence record writes on every decision

**Multi-tenancy**: every query scoped to `tenantId`; enforced via `requireTenantAccess()`. RLS aligns with `tenant_users` membership.

**Auth**: Supabase SSR cookie sessions. Two clients — browser (anon key, RLS enforced) and admin (service role, server-only). Roles defined in `src/lib/apiRoleMatrix.ts` (owner/admin/analyst/viewer).

**Inngest workflows**: triggered by events, not cron (except scheduled scans, digest, compliance snapshot, awareness refresh). Entry point: `POST /api/inngest`.

**OPA**: optional external evaluator at `OPA_POLICY_EVAL_URL`. Fail-open by default; set `OPA_FAIL_ON_ENDPOINT_ERROR=true` for fail-closed (escalates with `sw360_opa_fail_closed: true`).

## Environment Variables

Required in `.env.local`:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Inngest
INNGEST_EVENT_KEY
INNGEST_SIGNING_KEY
INNGEST_DEV=true          # local dev
INNGEST_BASE_URL

# Decision engine
DECISION_ENGINE_PROVIDER=rules   # or: opa
OPA_BASE_URL
OPA_POLICY_PATH
OPA_POLICY_EVAL_URL
OPA_FAIL_ON_ENDPOINT_ERROR=false

# Remediation
REMEDIATION_HUMAN_IN_THE_LOOP=true
REMEDIATION_EXEC_ISOLATE_COMMAND
REMEDIATION_EXEC_PATCH_COMMAND

# SLA defaults (hours)
APPROVAL_DEFAULT_SLA_HOURS=72
RISK_EXCEPTION_REVIEW_SLA_HOURS=168

# ITSM integrations (optional)
# Jira, ServiceNow, ConnectWise, Tenable, Semgrep credentials

# Security testing (CI only)
ZAP_TARGET_URL
OSINT_PRIMARY_DOMAIN
```

## Database

Migrations in `supabase/migrations/` — timestamped `YYYYMMDDHHMMSS_*.sql`. Core tables: `tenants`, `scan_targets`, `scan_runs`, `findings`, `remediation_actions`, `approval_requests`, `risk_exceptions`, `evidence_records`, `audit_logs`, `policies`, `policy_bindings`, `policy_decisions`, `control_requirements`, `cve_catalog`, `compliance_control_mappings`, `tenant_compliance_posture`, `notification_subscription_rules`.

When adding columns or tables, create a new migration file — never edit existing ones.

## CI/CD

`.github/workflows/security-scans.yml`:
- **PR to develop**: `npm audit` + Semgrep SAST + Trivy infra scan + OPA policy gate
- **Nightly**: OWASP ZAP DAST
- **Scheduled**: OSINT surface scan (Amass/theHarvester/nuclei)

## What to Avoid

- Never call `getSupabaseAdminClient()` from client-side code.
- Never bypass `requireTenantAccess()` — all API routes must scope to `tenantId`.
- Never put policy decision logic in API route handlers — use `decisionEngine.ts`.
- Never edit existing migration files — add new ones.
- Do not add LLM calls to policy evaluation or remediation routing paths (deterministic only).
- Do not commit `.env.local` or service role keys.
