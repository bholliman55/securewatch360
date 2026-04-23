import type { TenantId } from "@/types";

/**
 * Pluggable provider-specific scanners. Implementations live alongside this
 * file; swap or add new adapters without changing Inngest flow shape.
 */
export type ScanContext = { tenantId: TenantId };

export type ScanResult = { adapterId: string; summary: string };

export interface ScannerAdapter {
  readonly id: string;
  run(ctx: ScanContext): Promise<ScanResult>;
}
