# OPA policy evaluation in production

SecureWatch360’s decision engine can call an HTTP-compatible evaluation endpoint (`OPA_POLICY_EVAL_URL`) that accepts JSON `{ input, policies[] }` and returns a `DecisionOutput`-shaped payload (see `src/lib/policyEvaluationService.ts`).

## Environment

| Variable | Purpose |
|---------|---------|
| `OPA_POLICY_EVAL_URL` | Full URL to your evaluation service (often behind API gateway) |
| `OPA_POLICY_EVAL_TOKEN` | Optional Bearer token sent as `Authorization` |
| `OPA_POLICY_EVAL_TIMEOUT_MS` | Request timeout (default 4000) |
| `OPA_FAIL_ON_ENDPOINT_ERROR` | `true` → fail-closed (`escalate`) when OPA is unreachable |

## Deployment patterns

1. **Sidecar / same cluster**: run your evaluation service next to the Next.js workload; use cluster DNS and mTLS at the mesh/gateway.
2. **Reverse proxy**: terminate TLS at nginx/Envoy; forward to OPA or a thin adapter that wraps `opa eval` / bundles.
3. **Contract**: version the JSON schema; store policy id/version in `policy_decisions` rows for audit.

The repo does **not** ship a raw `opa run` JSON adapter—most teams expose a small bridge that loads Rego bundles and maps OPA results into `DecisionOutput`.

Reference compose (healthcheck only—replace image/command with your adapter):

See `deploy/opa/docker-compose.yml`.
