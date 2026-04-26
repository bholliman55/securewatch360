# Technical and product risks (v4)

This document tracks the risk items called out in product / architecture reviews, how they are **handled today** in code or process, and the **next steps** on the roadmap. It complements `docs/V4-ENGINEERING-GUARDRAILS.md` (scope) and the root `README.md` (runtime behavior).

## 1. OPA integration is adapter-based (HTTP endpoint)

**Risk:** Policy evaluation for `DECISION_ENGINE_PROVIDER=opa` relies on a compatible HTTP endpoint (`OPA_POLICY_EVAL_URL` and related env vars), not an in-process or embedded OPA. That is intentional for deployment flexibility but creates an integration boundary (network, contract, and availability).

### Handled today (OPA integration)

- A single merge path: `policyEvaluationService.evaluateAgainstPolicies()` calls the endpoint, then merges with deterministic rules via `policyPrecedence` (`mergePolicyOutputs`).
- If the endpoint is missing, unreachable, or returns a bad payload, evaluation **falls back** to the rules engine and records the situation in result metadata and/or `PolicyEvaluationResult.errors` (see `decisionEngine` / `policyEvaluationService`).
- The decision entrypoint remains `evaluateDecision()` so call sites do not implement ad-hoc OPA clients.

### Roadmap (hardening options)

- **Production:** run OPA as a sidecar or cluster service with auth, mTLS, and SLOs; version the JSON contract in-repo.
- **Alternatives:** `@open-policy-agent/opa-wasm` or similar for selected policies where HTTP is not desired.
- **Governance:** align Rego in DB with the bundle or image used by the OPA service (CI validation of Rego, policy id / version in audit rows).

## 2. Remediation execution adapters are not fully productized

**Risk:** The remediation **agent** already stamps `integration.adapterKey` / `connector` in `execution_payload` (`remediationAgent`). The **execution worker** historically mapped `action_type` to shell hooks (`REMEDIATION_EXEC_*_COMMAND`) only, so adapter identity was not fully reflected at execution time.

### Handled today (remediation execution)

- The executor in `remediationExecution.ts` reads `execution_payload.integration.adapterKey` and:
  - resolves per-adapter / per-step command env names when present, with backward-compatible fallbacks;
  - writes `adapterKey` and `connector` (when present) into `execution_result` for audit and support.
- Non-shell adapters (for example `ticketing`) are explicitly surfaced as skipped or connector-backed so behavior is not silently wrong.

### Roadmap (remediation execution)

- Replace or supplement shell templates with first-class connector modules (ConnectWise, Ansible runner API, cloud CLIs) keyed by `adapterKey`.
- Inngest workflows already fan out on execution completion; extend with per-adapter retry and dead-letter where needed.

## 3. Role-based access is not “fully hardened” (defense in depth)

**Risk:** `requireTenantAccess` / `requireTenantAccessForFinding` in `tenant-guard.ts` enforce membership and optional role allowlists, but RLS, service roles, and route-level checks must stay aligned. Any missing guard on a route is a tenant isolation bug.

### Handled today (role-based access)

- **Route guards:** API routes that accept a `tenantId` (or resolve it from an entity) should use `requireTenantAccess` with an explicit `allowedRoles` list.
- **Source of role lists:** `src/lib/apiRoleMatrix.ts` centralizes the intended role groups (`read` / `mutate` / `approve` / `remediation_execute`, etc.) so new routes can import one constant instead of copying ad-hoc arrays.

### Roadmap (role-based access)

- Periodic audit: every `src/app/api/**/route.ts` that touches tenant data should import from `apiRoleMatrix` and pass `allowedRoles: [...]`.
- Supabase RLS policies and server-only service role usage remain required for a full story; this repo assumes migrations define RLS—verify in `supabase/migrations/`.

## 4. Inconsistent API patterns (naming, auth, error shape)

**Risk:** Endpoints may differ in query param names, default limits, or JSON keys (`ok` / `error` are common but not guaranteed everywhere without review).

### Handled today (API patterns)

- Prefer `GET` with `tenantId` query param; `POST` JSON bodies for mutations; return `{ ok: boolean, error?: string }` on new routes.
- Policy export machine auth remains documented in `README` / `docs/API-MW-CONNECTOR.md` where applicable.

### Roadmap (API patterns)

- Optional thin wrapper: `jsonOk` / `jsonError` helpers and shared UUID validation in `src/lib/api-helpers.ts` (when touching multiple routes in one change set).
- OpenAPI or a generated client for external integrators (future).

## 5. Mitigations already in the repo (process)

- **Modular decisioning and execution** keep changes local (`decisionEngine`, `policyEvaluationService`, `remediationExecution`, Inngest functions).
- **Roadmap:** this file and `README` are the living checklist; use Git feature branches and PRs to `develop` per `CONTRIBUTING.md`.

## Review cadence

Revisit this document when:

- OPA deployment topology or contract changes
- A new external execution backend is added
- A new tenant-scoped API is introduced or a role is added to `TenantRole`
