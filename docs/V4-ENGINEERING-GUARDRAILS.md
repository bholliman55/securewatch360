# SecureWatch360 v4 Engineering Guardrails

This document is the implementation guardrail for v4 work.

## Non-negotiable constraints

1. Rules-based first.
2. OPA/Rego for policy logic, not LLM decisioning.
3. Clear module boundaries.
4. No giant generic frameworks.
5. Auditable data models.
6. Keep execution and approval separate.
7. Keep code readable and operational.
8. No fake enterprise complexity.

## How to apply these constraints

### Rules-based first

- New decision behavior starts in deterministic TypeScript rules.
- If needed, mirror behavior in Rego and move provider to OPA-compatible mode.
- Do not block delivery on a full policy-engine platform migration.

### OPA/Rego instead of LLM policy logic

- Policy outcomes must be reproducible from structured inputs.
- Rego and typed rule functions are allowed.
- LLM text generation can assist docs or operator UX, but not authoritative policy decisions.

### Clear module boundaries

- Keep policy evaluation in `decisionEngine` + policy services.
- Keep compliance mapping/evidence logic in `complianceAgent`.
- Keep remediation routing/payload logic in `remediationAgent`.
- Keep workflow orchestration in Inngest functions; do not embed large policy engines in route handlers.

### Avoid giant frameworks

- Prefer small focused modules over meta-framework abstractions.
- Introduce adapters only where a concrete integration exists (Ansible/cloud/ticket/etc).
- No shared "super orchestrator" class unless duplicated behavior proves it is needed.

### Auditable models

- Persist decision inputs/outputs and decision logs.
- Record approval and exception state transitions.
- Ensure key workflow actions write meaningful audit log records.

### Keep execution and approval separate

- Approval state is governance.
- Execution state is operational runtime.
- Do not collapse these into one status field.

### Readability standards

- Keep step boundaries explicit in workflows (`step.run`).
- Prefer descriptive names over generic utility wrappers.
- Keep failure messages actionable and include entity IDs when possible.

## Scope control checklist (before merging)

- Is this change solving a concrete current workflow need?
- Can an on-call engineer trace decisions and actions from database records?
- Did we add any abstraction that has only one caller and no clear second use case?
- Does this preserve deterministic behavior for the same input?
- Does this keep v4 runnable locally without complex platform dependencies?

If any answer is "no", simplify before merging.
