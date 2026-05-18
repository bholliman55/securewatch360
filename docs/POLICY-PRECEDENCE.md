# Policy Precedence

`src/lib/policyPrecedence.ts` merges the outputs of multiple independent policy evaluations — rules engine, OPA, any future evaluators — into a single authoritative `DecisionOutput`.  It enforces a strict hierarchy so that the "strongest" constraint always wins.

## Why this exists

`decisionEngine.ts` can call the rules engine and an optional OPA endpoint in the same request.  Both return a `DecisionOutput`.  `mergePolicyOutputs()` is the single choke point that combines those results without letting a permissive evaluator override a restrictive one.

## Action strength order

From weakest to strongest:

```
allow
  monitor_only
    request_risk_acceptance
      create_remediation
        auto_remediate
          escalate
            block
```

This ordering is applied by `mergePolicyOutputs()` — a `block` from any single evaluator wins unconditionally.

## Merge rules

```
hasExplicitBlock = any(decisions.action === "block")
requiresApproval = any(decisions.requiresApproval === true)
```

### Resulting action

| Condition | Resulting action |
|---|---|
| `hasExplicitBlock` | `block` |
| `requiresApproval && hasEscalate` | `escalate` |
| `requiresApproval && hasRemediation` | `create_remediation` |
| `requiresApproval && hasRiskAcceptance` | `request_risk_acceptance` |
| `requiresApproval` only | `allow` |
| `hasEscalate` (no block, no approval) | `escalate` |
| `hasAutoRemediate` (no block, no approval) | `auto_remediate` |
| `hasRemediation` | `create_remediation` |
| `hasMonitorOnly` | `monitor_only` |
| `hasRiskAcceptance` | `request_risk_acceptance` |
| none of the above | `allow` |

**Key invariant:** approval-required always beats auto-remediate.  If any evaluator sets `requiresApproval = true`, auto-remediation is disabled regardless of whether another evaluator allowed it.

### Flags

| Flag | Rule |
|---|---|
| `requiresApproval` | `true` if block **or** any evaluator set it; `false` otherwise |
| `autoRemediationAllowed` | `true` only when no block, no approval requirement, and at least one evaluator allowed it |
| `riskAcceptanceAllowed` | `false` when block present; `true` only when **all** evaluators allow it |

### Reason codes and matched policies

Reason codes from all evaluators are merged (de-duplicated).  When `hasExplicitBlock`, `severity_threshold_exceeded` is appended.  Matched policies from all evaluators are merged by `policyId` — last write wins for the same ID.

## Empty inputs

When `decisions` is an empty array, `mergePolicyOutputs()` returns a permissive default:

```typescript
{
  action: "allow",
  requiresApproval: false,
  autoRemediationAllowed: false,
  riskAcceptanceAllowed: true,
  reasonCodes: ["policy_not_matched"],
  matchedPolicies: [],
}
```

This matches the **fail-open** posture described in `CLAUDE.md`.  OPA failing to respond does **not** automatically block; `OPA_FAIL_ON_ENDPOINT_ERROR=true` must be set to flip to fail-closed.

## Usage

```typescript
import { mergePolicyOutputs } from "@/lib/policyPrecedence";

const merged = mergePolicyOutputs([
  { decision: rulesDecision, source: "rules" },
  { decision: opaDecision, source: "opa" },
]);
// merged.action is the authoritative result
```

`mergePolicyOutputs` is called by `decisionEngine.ts` after all evaluators complete.  Do not call it directly from API routes.

## Constraints

- Do not add LLM output as a `DecisionWithSource` — policy decisions must be deterministic.
- Do not bypass `mergePolicyOutputs` to combine evaluator results manually — precedence logic must stay in one place.
- The `metadata.decisionSources` array in the output is for audit/tracing only; downstream code should not branch on its contents.
