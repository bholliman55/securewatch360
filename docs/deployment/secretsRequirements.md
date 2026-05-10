# Secrets and environment variables

**Never commit** `.env`, `.env.local`, or service role keys. Reference names only in documentation.

## Always required for production startup

The production gate in `src/core/deployment/environmentConfigValidator.ts` fails closed when any of these are empty while running in a **production-like** environment (`NODE_ENV=production`, `VERCEL_ENV=production`, or `SW360_DEPLOYMENT_ENV=production|prod`):

| Variable | Role |
|----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server client (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin client |
| `INNGEST_SIGNING_KEY` | Verify Inngest calls to `/api/inngest` |
| `INNGEST_EVENT_KEY` | Emit Inngest events from workers |

## Optional / feature-specific (not gated by default)

Examples (non-exhaustive): OPA URLs, ITSM API tokens, SMTP, Slack webhooks, scanner credentials, Bright Data, ZAP. Add these to your runbook per tenant and per integration.

## Demo and simulation separation (production)

The following **must be unset or false** in production-like deployments, or startup validation **throws**:

- `SIMULATION_DEMO_MODE`
- `INVESTOR_DEMO_MODE`
- `NEXT_PUBLIC_INVESTOR_DEMO_MODE`

Rationale: demo and simulator fixtures must not hydrate production tenants, audits, or remediation planes (see `simulator/fixtures/demoMode.ts` and `remediationGuardrails.ts`).

## Break-glass (emergency only)

`SW360_SKIP_DEPLOYMENT_VALIDATION=true` disables the production startup gate. Use only under change control; remove as soon as configuration is repaired.

## Deployment model selection

| Variable | Values |
|----------|--------|
| `SW360_DEPLOYMENT_MODEL` | `saas_multi_tenant`, `msp_multi_tenant`, `customer_isolated_tenant`, `hybrid_collector`, `on_prem_collector`, `gov_ready_isolated` |
| `SW360_HYBRID_COLLECTOR_ENABLED` | `true` / `false` — should align with hybrid collector model |
| `SW360_ON_PREM_COLLECTOR_ONLY` | `true` / `false` — document cloud-side processing if false under on-prem model |
| `SW360_GOV_DEPLOYMENT_ACK` | Set to `1` after gov readiness checklist for `gov_ready_isolated` |

## Gov readiness acknowledgment

For `gov_ready_isolated`, validation warns until `SW360_GOV_DEPLOYMENT_ACK=1` is set, signaling that residency, FIPS, and access reviews were completed outside the repo.
