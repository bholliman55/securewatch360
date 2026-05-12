# Production readiness — incomplete work inventory

This document records **placeholder text, TODO/FIXME markers, structural gaps, and intentional stubs** found when auditing the repo for unfinished “production ready” work. Use it as a checklist for remediation.

**Audit approach (repeatable)**

- Ripgrep for phrases such as: `replace with your`, `TODO`, `FIXME`, `stub`, `not implemented`, `placeholder` (filtered to code/config, not UI `placeholder=` attributes).
- For policy-as-code IaC: compare generated layout to `policy_framework_controls` in `supabase/migrations/20260425150000_policy_pack_full_catalog.sql` (`npm run generate:policy-pack-iac`).

---

## 1. Infrastructure as code — policy pack (Ansible + Terraform)

| Item | Location | Issue | Remediation |
|------|----------|-------|-------------|
| Full catalog alignment | `iac/securewatch360-policy-pack/` ↔ `20260425150000_policy_pack_full_catalog.sql` | **Current state:** `scripts/generate-policy-pack-iac.mjs` regenerates **~995** `policy_*` Ansible roles plus matching Terraform modules under `terraform/modules/policies/<slug>/`. Root Terraform uses **`module.policy_control`** with **`for_each`** over `terraform/generated/control_slugs.json`. Playbook lists every role grouped by framework. | After **any** catalog change (`generate-policy-pack-full-sql.mjs` / migration edits), run `npm run generate:policy-pack-iac`. Optionally hand‑enrich high‑value slug(s) locally and add generator “skip overlays” later if stubs are too thin. |
| GV.PO-01 depth | `iac/.../roles/policy_nist_gv_po_01/tasks/main.yml` | Role is currently a **generated catalog stub** (debug message), not the older evidence-directory playbook. That richer implementation was superseded when the tree was regenerated for full-catalog parity. | If product needs GV.PO-01 automation again, restore a handcrafted `tasks/main.yml` (and/or terraform module detail) behind a documented overlay or conditional in the generator. |
| IaC QA | Terraform / Ansible binaries on PATH | `npm run qa:iac` validates when tools are installed. | Run in CI with Terraform + Ansible available. |

---

## 2. Database — Agent 6 quantum tables (RLS)

| Item | Location | Issue | Remediation |
|------|----------|-------|-------------|
| Quantum RLS | `supabase/migrations/20260428210000_create_agent6_quantum_tables.sql` (original policies) | ~~Placeholders / `true` policies.~~ **Done:** superseded by `20260505203000_quantum_tables_tenant_scoped_rls.sql` (merged via PR #43). | Keep original migration unchanged; future RLS tweaks only in new migrations. |

---

## 3. Application — Agent 6 quantum readiness

| Item | Location | Issue | Remediation |
|------|----------|-------|-------------|
| Orchestrator | `src/agents/agent6-quantum-readiness/index.ts` | ~~TODO persistence + OPA~~ **Done:** `persistQuantumReadinessOutput` in `src/lib/quantumAssessmentPersistence.ts`, optional OPA in `quantumOpaEvaluation.ts`, `POST /api/quantum/readiness-assessment`. | Operational: load quantum bundles on OPA; tune timeouts via `OPA_POLICY_EVAL_TIMEOUT_MS`. |
| README | `src/agents/agent6-quantum-readiness/README.md` | ~~Referenced open RLS TODO.~~ **Done:** points at tenant-scoped RLS migration. | — |

---

## 4. Integrations — Bright Data client

| Item | Location | Issue | Remediation |
|------|----------|-------|-------------|
| Config + SERP envelopes | `src/integrations/brightdata/*.ts` | ~~“Wire: replace…” placeholders~~ **Done:** env-driven URLs (`brightDataConfig.ts`), SERP normalisation for `organic` / `organic_results` / `results` (`brightDataClient.ts`). | Add fixture tests from real vendor JSON samples; optional `HttpsProxyAgent` if the runtime must route via the gateway explicitly. |

---

## 5. Inngest registration (resolved)

| Item | Location | Note |
|------|----------|------|
| Approval / risk SLA sweep | `approval-risk-sla-sweep.ts` → `inngestFunctions` | ~~Was missing from `index.ts`.~~ **Done:** `approvalRiskSlaSweep` is imported and registered in `src/inngest/functions/index.ts`. Cron: hourly (`0 * * * *`). |

---

## 6. Notifications & outbound alerts (still stub-level in places)

| Item | Location | Note |
|------|----------|------|
| Digest sends | `src/inngest/functions/notification-digest.ts` | Records **`notification.digest.stub`** in audit/evidence — **no SMTP/Slack transport** wired in this function yet. |
| Scheduled reports email | `src/inngest/functions/runScheduledReports.ts` | Builds evidence package → **`audit_logs`** only; **no email dispatch**. |
| Architectural guardrail | `.cursor/skills/alert-dispatcher/SKILL.md` | When implementing real delivery, funnel sends through one dispatcher (tenant-scoped credentials, partial success + idempotency, audit/evidence) — do not scatter transport calls across agents. |

---

## 7. Other grep hits (context only)

| Item | Location | Note |
|------|----------|------|
| Scanner finding text | `ui/supabase/functions/execute-scan/index.ts` | Describes a finding **“TODO or FIXME markers”** — product copy / rule text; change only if you want different wording. |
| Simulator / tests | Various `stub`, `fixture` names | Expected for deterministic lab data; not necessarily production debt. |

---

## 8. Suggested closure order (living backlog)

Historical completions stay in §9 changelog below.

1. **Outbound notifications:** replace digest + scheduled-report “stub only” paths with transport-backed delivery aligned with **`alert-dispatcher`** skill (`email` / `Slack` / etc.).
2. **Quantum / Bright Data:** operational hardening above (fixture tests; proxy notes).
3. **Policy pack GV.PO-01 (optional):** restore handcrafted depth where the stub is insufficient.

---

## 9. Changelog for this doc

| Date | Change |
|------|--------|
| 2026-05-05 | Initial inventory from repo audit (grep + playbook/layout review). |
| 2026-05-05 | Recorded completion: quantum RLS migration (PR #43); Ansible role expansion; playbook documentation. |
| 2026-05-06 | Agent 6: Supabase persistence + optional OPA + `POST /api/quantum/readiness-assessment`. |
| 2026-05-06 | Bright Data client: configurable gateway/SERP URLs, SERP envelope parsing. |
| 2026-05-06 | Inventory refresh: policy pack **~995** generator-driven roles/modules; GV.PO-01 stub; notification/report stubs; **`alert-dispatcher`**. **`approvalRiskSlaSweep`** registered in `src/inngest/functions/index.ts`. |

When an item is fixed, update the corresponding row or append a dated note under §9 instead of deleting useful history.