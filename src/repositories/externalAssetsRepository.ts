import { getSupabaseAdminClient } from "@/lib/supabase";
import type { DiscoveredAsset } from "@/agents/agent1-scanner/externalDiscoveryTypes";

export interface ExternalAssetRow {
  id: string;
  scan_id: string | null;
  client_id: string | null;
  domain: string;
  asset_type: string;
  asset_value: string;
  source: string | null;
  confidence: number | null;
  risk_hint: string | null;
  discovered_at: string;
  raw: unknown;
  created_at: string;
}

export async function upsertExternalAssets(assets: DiscoveredAsset[]): Promise<void> {
  if (assets.length === 0) return;
  const supabase = getSupabaseAdminClient();

  const rows = assets.map((a) => ({
    scan_id: a.scanId,
    client_id: a.clientId ?? null,
    domain: a.domain,
    asset_type: a.assetType,
    asset_value: a.assetValue,
    source: a.source,
    confidence: a.confidence,
    risk_hint: a.riskHint ?? null,
    discovered_at: a.discoveredAt.toISOString(),
    raw: a.raw ?? null,
  }));

  const { error } = await supabase
    .from("external_assets")
    .upsert(rows, { onConflict: "domain,asset_type,asset_value", ignoreDuplicates: false });

  if (error) throw new Error(`Failed to upsert external assets: ${error.message}`);
}

export async function getExternalAssets(
  domain: string,
  options: { clientId?: string; scanId?: string; limit?: number } = {}
): Promise<ExternalAssetRow[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("external_assets")
    .select("*")
    .eq("domain", domain)
    .order("discovered_at", { ascending: false })
    .limit(options.limit ?? 200);

  if (options.clientId) query = query.eq("client_id", options.clientId);
  if (options.scanId) query = query.eq("scan_id", options.scanId);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch external assets: ${error.message}`);
  return data ?? [];
}
