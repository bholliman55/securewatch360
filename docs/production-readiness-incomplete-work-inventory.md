# Production readiness — incomplete work inventory

This document records **placeholder text, TODO/FIXME markers, and structural gaps** found when auditing the repo for unfinished “production ready” work. Use it as a checklist for remediation.

**Audit approach (repeatable)**

- Ripgrep for phrases such as: `replace with your`, `TODO`, `FIXME`, `Wire: replace`, `not implemented`, `placeholder` (filtered to code/config, not UI `placeholder=` attributes).
- Manual review of the SecureWatch360 policy-pack Ansible layout vs `playbook-securewatch360-policy-pack.yml`.

---

## 1. Infrastructure as code — Ansible policy pack

| Item | Location | Issue | Remediation |
|------|----------|-------|-------------|
| GV.PO-01 role | `iac/securewatch360-policy-pack/ansible/roles/policy_nist_gv_po_01/tasks/main.yml` | ~~Task name contained “replace with your hardening tasks”; role only ran `debug`.~~ **Done (2026-05-05):** portable evidence directory + markdown artefact + optional enforced gate. | Keep role aligned to NIST CSF 2.0 GV.PO-01 narratives; extend with tenant-specific attestations. |
| All catalog roles on disk | `playbook-securewatch360-policy-pack.yml` ↔ `ansible/roles/*/tasks/main.yml` | ~~Only three NIST roles existed; non-NIST frameworks missing.~~ **Done (2026-05-05):** all **22** roles exist — every framework in the playbook. | When the SQL catalog adds new `ansible_role` values, add matching role directories in the same repo. |

**Framework coverage (closure order #2 — all eleven frameworks, not NIST-only):** NIST CSF 2.0 (3 roles), HIPAA (2), PCI-DSS (2), ISO 27001 (2), SOC 2 (2), CIS Controls (2), GDPR (2), FedRAMP (2), CMMC (2), COBIT (2), CCPA (2) — **22 advisory reference roles** plus inline documentation in the playbook header.

---

## 2. Database — Agent 6 quantum tables (RLS)

| Item | Location | Issue | Remediation |
|------|----------|-------|-------------|
| Quantum RLS | `supabase/migrations/20260428210000_create_agent6_quantum_tables.sql` (original policies) | ~~Placeholders / `true` policies.~~ **Done:** superseded by `20260505203000_quantum_tables_tenant_scoped_rls.sql` (merged via PR #43). | Keep original migration unchanged; future RLS tweaks only in new migrations. |

---

## 3. Application — Agent 6 quantum readiness

| Item | Location | Issue | Remediation |
|------|----------|-------|-------------|
| Orchestrator | `src/agents/agent6-quantum-readiness/index.ts` | JSDoc and inline **TODO** for **Supabase persistence** and **OPA/Rego** HTTP evaluation. | Implement persistence (e.g. `src/lib/quantumAssessmentPersistence.ts` using service-role server path) and optional OPA calls to `policies/rego/quantum/*.rego` packages, or remove TODOs only after those features exist elsewhere and the contract is updated. |
| README | `src/agents/agent6-quantum-readiness/README.md` | ~~Referenced open RLS TODO.~~ **Done:** points at tenant-scoped RLS migration. | — |

---

## 4. Integrations — Bright Data client

| Item | Location | Issue | Remediation |
|------|----------|-------|-------------|
| Comments | `src/integrations/brightdata/brightDataClient.ts` | **“Wire: replace with…”** on endpoints and SERP implementation. | Either implement configurable hosts via `BrightDataConfig` / env, or replace comments with accurate documentation that defaults are intentional and how to override—remove “replace with your” wording so grep stays clean. |

---

## 5. Other grep hits (context only)

| Item | Location | Note |
|------|----------|------|
| Scanner finding text | `ui/supabase/functions/execute-scan/index.ts` | Describes a finding **“TODO or FIXME markers”**—this is product copy / rule description, not an internal TODO to fix unless you want different wording. |
| Simulator / tests | Various `stub`, `fixture` names | Expected for deterministic lab data; **not** necessarily production debt. |

---

## 6. Suggested closure order

1. ~~**Quantum RLS**~~ — **Done** (`20260505203000_quantum_tables_tenant_scoped_rls.sql`, PR #43 → `main`).
2. ~~**Ansible playbook + missing roles (all frameworks)**~~ — **Done** — every framework in the pack (NIST, HIPAA, PCI-DSS, ISO 27001, SOC 2, CIS, GDPR, FedRAMP, CMMC, COBIT, CCPA) has an on-disk `roles/<ansible_role>/tasks/main.yml`; playbook header lists all 22 roles.
3. ~~**GV.PO-01**~~ — **Done** — evidence directory + markdown artefact + enforced-mode assert (see role `tasks/main.yml`).
4. **Agent 6 persistence + OPA** — implement or formally defer in README/API contract.
5. **Bright Data client** — clarify configuration vs stub language.

---

## 7. Changelog for this doc

| Date | Change |
|------|--------|
| 2026-05-05 | Initial inventory from repo audit (grep + playbook/layout review). |
| 2026-05-05 | Recorded completion: quantum RLS migration (PR #43); full eleven-framework Ansible role set + GV.PO-01 hardening tasks; playbook/framework documentation. |

When an item is fixed, update the corresponding row or append a dated note under §7 instead of deleting history, until the checklist is fully clear.
