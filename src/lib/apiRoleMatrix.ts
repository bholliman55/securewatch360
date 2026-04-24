import type { TenantRole } from "@/lib/tenant-guard";

/**
 * Central role allowlists for tenant-scoped API routes. Prefer importing these
 * in `requireTenantAccess({ allowedRoles: ... })` so read vs write vs execute
 * stays consistent across endpoints.
 */
export const API_TENANT_ROLES: {
  read: readonly TenantRole[];
  mutate: readonly TenantRole[];
  admin: readonly TenantRole[];
  /** Approvals, risk accept/reject, policy-impacting config */
  approval: readonly TenantRole[];
  /** Remediation dry-run/execute, scan request, high-impact automation */
  remediationAndScan: readonly TenantRole[];
} = {
  read: ["owner", "admin", "analyst", "viewer"],
  mutate: ["owner", "admin", "analyst"],
  admin: ["owner", "admin"],
  approval: ["owner", "admin"],
  remediationAndScan: ["owner", "admin", "analyst"],
} as const;
