import type { DeploymentModel } from "./deploymentMode.schema";

export type CollectorPosture = "cloud_managed" | "hybrid_edge" | "customer_on_prem" | "gov_airgapped";

export type TenantIsolationPolicy = {
  deployment_model: DeploymentModel;
  /** Postgres RLS (or equivalent) must scope all tenant-bound rows. */
  enforce_supabase_rls: boolean;
  /** Single logical control plane serves many tenants (SaaS / MSP). */
  shared_control_plane: boolean;
  /** Each production tenant maps to a dedicated DB or schema with no cross-tenant queries. */
  dedicated_tenant_data_plane: boolean;
  /** Collectors run in customer network; only normalized bundles egress to SW360. */
  collector_posture: CollectorPosture;
  /** Service role key material must never ship to browsers or collector bundles. */
  forbid_client_embedded_service_role: boolean;
  /** Tenant credentials for outbound ITSM / cloud APIs are scoped per tenant in vault. */
  require_tenant_scoped_integration_secrets: boolean;
  /** Written requirements for audits (SOC2, FedRAMP, etc.). */
  audit_notes: string[];
};

/**
 * Baseline isolation expectations per deployment model — implementers align infra + runbooks to this matrix.
 */
export function getTenantIsolationPolicy(model: DeploymentModel): TenantIsolationPolicy {
  const base = (overrides: Partial<TenantIsolationPolicy>): TenantIsolationPolicy => ({
    deployment_model: model,
    enforce_supabase_rls: true,
    shared_control_plane: true,
    dedicated_tenant_data_plane: false,
    collector_posture: "cloud_managed",
    forbid_client_embedded_service_role: true,
    require_tenant_scoped_integration_secrets: true,
    audit_notes: [],
    ...overrides,
  });

  switch (model) {
    case "saas_multi_tenant":
      return base({
        shared_control_plane: true,
        dedicated_tenant_data_plane: false,
        collector_posture: "cloud_managed",
        audit_notes: [
          "All API routes must call requireTenantAccess() (or equivalent) before querying tenant data.",
          "RLS policies must mirror application tenant predicates — periodic drift checks recommended.",
        ],
      });
    case "msp_multi_tenant":
      return base({
        shared_control_plane: true,
        dedicated_tenant_data_plane: false,
        require_tenant_scoped_integration_secrets: true,
        audit_notes: [
          "MSPs often map one MSP operator user to many customer tenants — enforce least-privilege RBAC and break-glass logging.",
          "Prefer separate Supabase projects per MSP customer for strongest isolation when contractually required.",
        ],
      });
    case "customer_isolated_tenant":
      return base({
        shared_control_plane: false,
        dedicated_tenant_data_plane: true,
        audit_notes: [
          "Dedicated Supabase project (or single-tenant cluster) per customer; no shared Postgres roles across customers.",
        ],
      });
    case "hybrid_collector":
      return base({
        collector_posture: "hybrid_edge",
        audit_notes: [
          "Collectors hold ephemeral credentials; only signed, normalized evidence crosses the trust boundary.",
          "Use SW360_HYBRID_COLLECTOR_ENABLED and document egress allowlists for upload endpoints.",
        ],
      });
    case "on_prem_collector":
      return base({
        collector_posture: "customer_on_prem",
        audit_notes: [
          "Assume intermittent connectivity — evidence store should tolerate store-and-forward with integrity hashes.",
        ],
      });
    case "gov_ready_isolated":
      return base({
        shared_control_plane: false,
        dedicated_tenant_data_plane: true,
        collector_posture: "gov_airgapped",
        audit_notes: [
          "FedRAMP / IL patterns: dedicated regions, FIPS endpoints, no public demo overlays in production namespaces.",
          "Document data residency, key custody (HSM), and personnel access for CJIS / CMMC where applicable.",
        ],
      });
  }
}
