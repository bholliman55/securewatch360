/**
 * Pluggable threat feed adapters — production implementations fetch from vendor APIs with tenant-scoped credentials.
 */

import type { ThreatIntelFeedId } from "./threatIntelItem.schema";

export type ThreatIntelFetchContext = {
  /** Optional tenant scope for MISP / OTX private pulses. */
  tenant_id?: string;
  cursor?: string;
  max_records?: number;
};

export type ThreatIntelRawBatch = {
  records: unknown[];
  next_cursor?: string;
};

/**
 * Vendor-specific pull — return opaque rows; normalizer maps to `ThreatIntelItem` inputs.
 */
export interface ThreatIntelFeedAdapter {
  readonly feed_id: ThreatIntelFeedId;
  readonly display_name: string;
  /** Default confidence when upstream does not provide per-record scores. */
  readonly default_confidence_0_1: number;

  fetchRaw(ctx: ThreatIntelFetchContext): Promise<ThreatIntelRawBatch>;
}
