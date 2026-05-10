# SecureWatch360 deployment models

This document aligns with `src/core/deployment/deploymentMode.schema.ts` and `tenantIsolationPolicy.ts`. Set `SW360_DEPLOYMENT_MODEL` to one of the values below (underscore form).

## SaaS multi-tenant (`saas_multi_tenant`)

- Single control plane, shared Postgres with strict RLS per tenant.
- Typical public-cloud SaaS: lowest ops burden, strongest reliance on application + RLS correctness.

## MSP multi-tenant (`msp_multi_tenant`)

- Same technical pattern as SaaS with contractual emphasis on MSP operators spanning many end-customer tenants.
- Enforce RBAC, break-glass, and optional **per-customer** Supabase projects when isolation requirements exceed shared-RLS.

## Customer-isolated tenant (`customer_isolated_tenant`)

- Dedicated data plane per customer (separate Supabase project or single-tenant database).
- Control plane may still be shared SaaS, or fully dedicated for that customer.

## Hybrid collector (`hybrid_collector`)

- Sensors or collectors run on customer or edge networks; only **normalized, signed** bundles egress to SecureWatch360.
- Set `SW360_HYBRID_COLLECTOR_ENABLED=true` when this topology is intentional. Validation emits a warning if the model is hybrid but the flag is off.

## On-prem collector (`on_prem_collector`)

- Primary ingestion path is customer-operated infrastructure with intermittent connectivity.
- Prefer store-and-forward evidence with content hashes (`src/core/evidence`) and explicit upload endpoints.

## Gov-ready isolated deployment (`gov_ready_isolated`)

- Dedicated regions, FIPS-capable endpoints, no demo/simulation overlays in production namespaces.
- After operational review, set `SW360_GOV_DEPLOYMENT_ACK=1` (see validator) so runbooks confirm residency and access controls.

## Related code

- Environment validation: `src/core/deployment/environmentConfigValidator.ts`
- Production startup gate: `instrumentation.ts` → `runDeploymentStartupGate`
- Secret inventory: [secretsRequirements.md](./secretsRequirements.md)
