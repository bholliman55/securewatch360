/**
 * App-wide and cross-boundary types. Keep event names in sync with
 * `src/inngest/functions`.
 */
export type TenantId = string;
export type ScanTargetId = string;

export type InngestEventMap = {
  "securewatch/scan.requested": {
    tenantId: TenantId;
    scanTargetId: ScanTargetId;
  };
  "securewatch/remediation.execution.completed": {
    tenantId: TenantId;
    remediationActionId: string;
    findingId: string;
    triggerType: "manual" | "semi_automatic" | "automatic";
  };
  "securewatch/remediation.execution.requested": {
    tenantId: TenantId;
    remediationActionId: string;
    findingId: string | null;
    requestedByUserId: string | null;
    source: "approval_workflow" | "system";
  };
  "securewatch/monitoring.alert.received": {
    tenantId: TenantId;
    source: string;
    alertType: string;
    severity: "info" | "low" | "medium" | "high" | "critical";
    title: string;
    description?: string;
    targetValue?: string;
    metadata?: Record<string, unknown>;
    createFinding?: boolean;
  };
};
