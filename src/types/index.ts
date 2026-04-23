/**
 * App-wide and cross-boundary types. Inngest event payloads: keep in sync
 * with the names in `src/inngest/`.
 */
export type TenantId = string;

export type InngestEventMap = {
  "sw360/scan.requested": {
    tenantId: TenantId;
  };
};
