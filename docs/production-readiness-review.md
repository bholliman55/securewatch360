# SecureWatch360 — Production Readiness Review

**Review scope:** Internal assessment of module maturity for **demo**, **pilot (limited live customers)**, and **enterprise production** against the current repository. This is not a third-party audit; it encodes what is **implemented in code** versus **stubs, in-memory stores, and lab paths** that require hardening for customer data.

**Last updated:** 2026-05-10 (repo state at time of writing).

---

## How to read this document

| Column / term | Meaning |
|---------------|--------|
| **Complete** | Real logic exists in `src/core/*` or `src/integrations/*` with types, tests (where noted), and a clear contract. |
| **Stubbed** | Placeholder implementations, in-memory `Map` stores, or “wire later” HTTP clients. |
| **Unsafe for production** | Would mislead operators, leak data, or bypass policy if used for real customer tenants without additional controls. |
| **Before live customer** | Minimum to treat a **paying** deployment as safe and supportable. |
| **Demo mode** | Investor demo, scripted scenarios, `SIMULATION_DEMO_MODE` / `INVESTOR_DEMO_MODE` style runs (see `simulator/fixtures/demoMode.ts`, `remediationGuardrails.ts`). |
| **Pilot mode** | Small set of real tenants with explicit SLAs, runbooks, and human oversight; not full enterprise hardening. |
| **Enterprise production** | Regulated, scale, and governance expectations (evidence, DR, pen test, access reviews, etc.). |

---

## 1. Endpoint telemetry strategy

**Location:** `src/core/telemetry/` (normalizer, capability matrix, mock adapters).

| Aspect | Status |
|--------|--------|
| **Complete** | Normalization pipeline shapes, mock endpoint adapters, mapping helpers suitable for tests and bring-up. |
| **Stubbed** | Persistent ingest queues, multi-region buffering, production-grade connector fleet beyond mocks. |
| **Unsafe for production** | Treating **mock** adapters as telemetry of record without wiring real EDR/Identity/NDR sources. |
| **Before live customer** | Contracted data sources, rate limits, PII redaction in logs, tenant-scoped credentials, backpressure and dead-lettering. |
| **Demo mode** | Mocks and simulator-only events are **acceptable**; label outputs as non-telemetry. |
| **Pilot mode** | 1–2 real connectors per critical path; SLOs for lag and loss; on-call playbooks. |
| **Enterprise production** | Full catalog of supported vendors, key rotation, attestation of agent coverage, audit export of collection config. |

---

## 2. Action execution safety

**Location:** `src/core/actions/` (`actionExecutor`, `action.schema`, `remediationGuardrails` in `src/core/safety/`).

| Aspect | Status |
|--------|--------|
| **Complete** | Dry-run, `approval_reference` gating for high-risk `ACTION_TYPES`, execution + audit path in design. |
| **Stubbed** | Some handlers may be mock or environment-specific; full ITSM/EDR live execution matrix varies by route. |
| **Unsafe for production** | Live execution with demo/simulation flags enabled; bypassing `requireTenantAccess` on API routes; missing approval on gated actions. |
| **Before live customer** | Kill-switch env vars documented; staging rehearsal for isolate/quarantine; rollback tokens exercised end-to-end. |
| **Demo mode** | **Acceptable** when guardrails force dry-run / blocked live execution (`SIMULATION_DEMO_MODE`, investor demo). |
| **Pilot mode** | Explicit allowlist of tenants and actions; human approval for destructive categories. |
| **Enterprise production** | Change windows, dual-control for catastrophic actions, evidence bundle per execution. |

---

## 3. Identity security coverage

**Location:** `src/agents/identity/` (normalizers, detectors, mock fixtures).

| Aspect | Status |
|--------|--------|
| **Complete** | Event normalization, finding generation, risk scoring heuristics in agent scope. |
| **Stubbed** | Real-time IdP webhooks for all vendors; long-term identity graph in DB. |
| **Unsafe for production** | Running only mock IdP data for real incident response; over-trusting `risk_score_0_100` without source validation. |
| **Before live customer** | IdP app registration, least-privilege API scopes, secret storage, and tenant mapping for production IdP. |
| **Demo mode** | Mock identity events and narrative are **acceptable**. |
| **Pilot mode** | One production IdP with narrow read scopes; false positive review process. |
| **Enterprise production** | UEBA integration where required, access reviews, and evidence of MFA / conditional access alignment. |

---

## 4. Asset inventory

**Location:** `src/core/assets/` (schema, registry, merger, relationship graph, risk context).

| Aspect | Status |
|--------|--------|
| **Complete** | Business-aware asset model, merge/dedupe, graph construction, lightweight risk context. |
| **Stubbed** | In-memory `AssetRegistry`; no durable multi-source sync from CMDB/cloud by default. |
| **Unsafe for production** | Using only lab assets for compliance scope without reconciling to real inventory. |
| **Before live customer** | Persistence (Postgres), scheduled refresh, and conflict resolution for source-of-truth. |
| **Demo mode** | **Acceptable** with fixture assets. |
| **Pilot mode** | One CMDB or cloud account linked; manual reconciliation process. |
| **Enterprise production** | Authoritative inventory, change detection, and graph export for IR and GRC. |

---

## 5. Business risk scoring

**Location:** `src/core/risk/` (`riskEngine`, scorers, schema).

| Aspect | Status |
|--------|--------|
| **Complete** | Deterministic multi-factor score, levels, explanation fields, test coverage. |
| **Stubbed** | Not yet the single source of truth in all API responses; may duplicate older heuristics elsewhere. |
| **Unsafe for production** | Presenting score as “regulator-ready” without mapping data quality and input completeness. |
| **Before live customer** | Wire inputs from real findings/assets; document weight governance; user-visible definitions. |
| **Demo mode** | **Acceptable** for storytelling. |
| **Pilot mode** | **Acceptable** with analyst override and audit of false positives. |
| **Enterprise production** | Model governance, versioned parameters, and evidence of calibration for insurance / audit. |

---

## 6. SOC integrations

**Location:** `src/integrations/soc/` (interface, schemas, `MockSocAdapter`, ConnectWise / Jira / Teams stubs, registry).

| Aspect | Status |
|--------|--------|
| **Complete** | Ticket/notify contract, correlation to `simulation_run_id` / `incident_id`, registry pattern. |
| **Stubbed** | All real HTTP to ConnectWise, Jira, ServiceNow, PagerDuty, Slack, Teams, email — **no production connectors in-repo**. |
| **Unsafe for production** | Shipping mock URLs as if they were customer PSA tickets without OAuth and tenant vault secrets. |
| **Before live customer** | At least one PSA + one paging/chat channel with secret refs and idempotent retries. |
| **Demo mode** | **Acceptable** — mocks only. |
| **Pilot mode** | Single PSA project / queue; narrow outbound scopes. |
| **Enterprise production** | HA outbound worker, DLQ, mapping tables per tenant, SOC2-ready logging (no secrets in logs). |

---

## 7. Evidence collection

**Location:** `src/core/evidence/` (schemas, in-memory store, package builder, custody, retention).

| Aspect | Status |
|--------|--------|
| **Complete** | Item schema with hashes, chain-of-custody events, JSON + Markdown package export, retention helpers. |
| **Stubbed** | `EvidenceStore` in memory; not yet the only write path for production evidence. |
| **Unsafe for production** | Relying on in-process only storage for legal hold or insurance claims. |
| **Before live customer** | Durable object store + Postgres index; WORM or immutability options for high-value tenants. |
| **Demo mode** | **Acceptable** for narrative packages. |
| **Pilot mode** | **Acceptable** with export to customer SIEM/archive weekly. |
| **Enterprise production** | Legal hold workflows, retention disputes, and jurisdictional residency. |

---

## 8. Deployment modes

**Location:** `docs/deployment/`, `src/core/deployment/`, root `instrumentation.ts`.

| Aspect | Status |
|--------|--------|
| **Complete** | Deployment model enum, isolation policy matrix, env validation, demo/prod separation gate, startup assertion in production-like runs. |
| **Stubbed** | Automated infra provisioning per `gov_ready_isolated` is documentation-driven only. |
| **Unsafe for production** | `SW360_SKIP_DEPLOYMENT_VALIDATION=true` left on; demo flags enabled in prod-like env (blocked by validator when configured correctly). |
| **Before live customer** | Remove skip flags; verify gates in CI; secrets in vault not `.env` on disk for ops. |
| **Demo mode** | Demo flags **acceptable** outside production-like detection. |
| **Pilot mode** | Single-region SaaS or MSP multi-tenant with RLS verification checklist. |
| **Enterprise production** | Dedicated DB / region options, DR drills, pen test against deployment gate list. |

---

## 9. AI governance

**Location:** `src/core/ai-governance/`.

| Aspect | Status |
|--------|--------|
| **Complete** | Schema validation, confidence gates, model routing hooks, hallucination heuristics, cost line tracking class, **recommendations cannot execute** (`execute_immediately: false`), high-risk action types require approval flags in schema. |
| **Stubbed** | Actual LLM providers and enterprise prompt store. |
| **Unsafe for production** | Bypassing `validateAiOutput`; routing recommendations straight to `executeAction` without human approval for gated types. |
| **Before live customer** | Central alert-dispatcher for AI-driven notifications per `.cursor/skills/alert-dispatcher/SKILL.md`; audit log of prompts (hashed) and outputs. |
| **Demo mode** | **Acceptable** with canned narratives. |
| **Pilot mode** | **Acceptable** with human review on action recommendations. |
| **Enterprise production** | Data residency for AI, model allowlist, DPIA / BAAs as applicable. |

---

## 10. Platform security

**Location:** `src/core/platform-security/` (signed events, tenant auth helpers, rate limiter, webhook HMAC, audit hash chain, idempotency).

| Aspect | Status |
|--------|--------|
| **Complete** | Cryptographic patterns, replay nonce guard, integration-test coverage for core primitives. |
| **Stubbed** | In-memory stores for rate limits, idempotency, nonces — **not distributed** across instances. |
| **Unsafe for production** | Single-instance assumptions for replay prevention; weak webhook secrets; logging raw webhook bodies with secrets. |
| **Before live customer** | Redis or equivalent for rate limit + idempotency; HMAC secrets from vault; middleware alignment with `requireTenantAccess`. |
| **Demo mode** | **Acceptable** on localhost. |
| **Pilot mode** | **Acceptable** with sticky sessions or shared Redis. |
| **Enterprise production** | DDoS edge, WAF rules, SIEM forwarding of security-relevant events, key rotation runbooks. |

---

## 11. Cost control

**Location:** `src/core/cost-control/`.

| Aspect | Status |
|--------|--------|
| **Complete** | Token/USD budget evaluation per tenant/incident/agent/simulation, model routing by complexity, caches and dedup helpers, runaway loop guard. |
| **Stubbed** | In-memory accounting; no billing system integration. |
| **Unsafe for production** | Unlimited LLM calls without provider budgets or kill switch in orchestration. |
| **Before live customer** | Wire `TokenBudgetManager.evaluateSpend` into worker ingress; alerts when thresholds exceeded. |
| **Demo mode** | **Acceptable** with low caps. |
| **Pilot mode** | **Acceptable** with monthly spend caps per tenant. |
| **Enterprise production** | Chargeback reports, reserved capacity, negotiated model routes. |

---

## 12. Threat intelligence

**Location:** `src/integrations/threat-intel/`.

| Aspect | Status |
|--------|--------|
| **Complete** | Normalized IOC/CVE schema, dedup cache, ingestion runner, registry with mocks for several feeds. |
| **Stubbed** | Live API clients for CISA KEV, NVD, OSV, abuse.ch, OTX, GreyNoise, MISP — **defaults are empty or mock**. |
| **Unsafe for production** | Acting on stale or unlicensed threat feeds; blocking traffic solely on mock intel. |
| **Before live customer** | Licensed feeds, SLA on freshness, fusion rules into findings with confidence display. |
| **Demo mode** | **Acceptable** with mock adapters. |
| **Pilot mode** | **Acceptable** with 1–2 paid feeds and analyst verification. |
| **Enterprise production** | TI program alignment (ISAC feeds), contractual use rights, and retention of intel artifacts. |

---

## 13. Post-remediation validation

**Location:** `src/core/remediation-validation/`.

| Aspect | Status |
|--------|--------|
| **Complete** | Plans/steps per action type, runner with hooks for evidence + reopen/escalate, dry-run / simulation behavior. |
| **Stubbed** | Default validators are **stubs** until scanners/IdP/PSA are wired. |
| **Unsafe for production** | Closing incidents without running real validation adapters. |
| **Before live customer** | At least rescan + ticket verification on critical paths; incident state machine integration. |
| **Demo mode** | **Acceptable** — stub passes marked simulated. |
| **Pilot mode** | **Acceptable** with manual analyst sign-off where automation missing. |
| **Enterprise production** | Mandatory validation evidence in audit trail; SLA for validation completion. |

---

## 14. Operator experience

**Location:** `src/core/operator-experience/`.

| Aspect | Status |
|--------|--------|
| **Complete** | Operator brief, executive brief, approval card schemas and builders (plain English, no raw logs in schema). |
| **Stubbed** | UI pages must consume these objects — wiring varies by route. |
| **Unsafe for production** | Dumping raw API payloads into “summary” panels despite schema intent. |
| **Before live customer** | Route handlers return these shapes for incident and simulation dashboards. |
| **Demo mode** | **Acceptable** and recommended for calm UX. |
| **Pilot mode** | **Acceptable** with copy review. |
| **Enterprise production** | Accessibility, localization, and role-based sections for executives vs analysts. |

---

## 15. Workflow memory

**Location:** `src/core/workflow-memory/`.

| Aspect | Status |
|--------|--------|
| **Complete** | Tenant-scoped memory entries, pattern detection, recommendations with **`auto_apply_forbidden`**, learning approval queue. |
| **Stubbed** | In-memory store; no ML; no automatic policy edits. |
| **Unsafe for production** | Auto-applying “suppressions” outside approval queue; cross-tenant memory leakage (prevented by design if APIs enforce tenant id). |
| **Before live customer** | Persist memory + approvals; integrate approval UI with policy change workflow. |
| **Demo mode** | **Acceptable** for showing recommendations only. |
| **Pilot mode** | **Acceptable** with human gate on every binding change. |
| **Enterprise production** | Governance committee, versioning of learned rules, rollback after bad approval. |

---

## 16. Attack simulation lab

**Location:** `simulator/` (scenarios, CLI, `simulator/README.md`, `docs/simulator/*`, demo mode coercion).

| Aspect | Status |
|--------|--------|
| **Complete** | Scenario engine, reporting, failure injection docs, demo mode that **does not** hydrate production workloads when configured correctly. |
| **Stubbed** | Not a substitute for purple-team tooling or customer-specific attack graphs. |
| **Unsafe for production** | `SIMULATION_MODE=supabase|inngest` against production tenant without isolation; demo data mixed with customer incidents. |
| **Before live customer** | Dedicated simulation tenant(s); separate reporting prefix; runbook (`STAGING-RUNBOOK.md`) followed. |
| **Demo mode** | **Acceptable and intended** — `SIMULATION_DEMO_MODE` forces local sink and blocks risky remediation. |
| **Pilot mode** | Scheduled simulations on **non-prod** or isolated tenant; compare outputs to production posture separately. |
| **Enterprise production** | Exercise scenarios only in approved windows; separate data classification for lab artifacts. |

---

## Summary matrix

| Area | Demo OK | Pilot OK | Enterprise production |
|------|---------|----------|------------------------|
| Telemetry | Mocks OK | Few live sources | Full connector program |
| Actions | Guardrails + dry-run | Allowlisted live | Full CM + evidence |
| Identity agent | Mock OK | One IdP live | Full program |
| Assets | In-memory OK | Sync one source | Authoritative CMDB |
| Risk engine | OK | OK with overrides | Governed model |
| SOC integrations | Stubs OK | One PSA + notify | Multi-integration HA |
| Evidence | Memory OK | Export discipline | Legal hold + store |
| Deployment | Demo flags OK | RLS verified | Gov / dedicated options |
| AI governance | Narrative OK | Human approval path | Residency + audit |
| Platform security | Single node OK | Redis-backed | Enterprise edge + SIEM |
| Cost control | Low caps OK | Budget alerts | Chargeback + contracts |
| Threat intel | Mocks OK | Paid feeds | Full TI program |
| Remediation validation | Stubs OK | Manual fallback | Automated proof |
| Operator UX | Built for this | Same | Exec dashboards |
| Workflow memory | Recs only OK | Approval queue | Persist + audit |
| Simulation lab | Demo mode designed | Isolated tenant | Lab ≠ prod data |

---

## Priority backlog (before first paid production tenant)

1. **Persistence:** Replace in-memory stores (evidence, threat intel cache, workflow memory, platform-security counters, asset registry) with tenant-scoped Postgres + object storage where applicable.  
2. **Secrets:** No service role or vendor keys in client bundles; vault integration for SOC and TI.  
3. **Actions:** End-to-end live execution tests per critical adapter with rollback verification.  
4. **Deployment:** Production startup validation enabled; demo flags impossible in prod-like env.  
5. **Simulation:** Dedicated tenant and sink discipline per `simulator/README.md` for any non-demo rehearsal.  
6. **Observability:** Metrics for ingestion lag, action failure rate, AI spend, and validation pass rate — not only console logs.

---

## Sign-off

This document should be paired with a **formal** security assessment (penetration test, threat model refresh, and customer-specific DPA) before marketing **enterprise-ready** status. The codebase provides **structural** readiness in multiple `src/core` modules; **operational** readiness requires customer-specific runbooks, staffing, and infrastructure choices not fully encoded in the repository.
