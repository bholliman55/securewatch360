import { getSupabaseAdminClient } from "@/lib/supabase";
import { hashPrompt } from "@/lib/token-optimization/promptHash";

export type ContextSummaryEntityType =
  | "finding"
  | "scan_run"
  | "asset"
  | "control"
  | "evidence_record"
  | "remediation_action";

export type StoredContextSummary = {
  id: string;
  tenantId: string | null;
  entityType: ContextSummaryEntityType;
  entityId: string;
  summaryType: string;
  summaryText: string;
  sourceHash: string;
  tokenEstimate: number | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type GetContextSummaryInput = {
  entityType: ContextSummaryEntityType;
  entityId: string;
  summaryType: string;
  tenantId?: string | null;
};

type UpsertContextSummaryInput = {
  tenantId?: string | null;
  entityType: ContextSummaryEntityType;
  entityId: string;
  summaryType: string;
  summaryText: string;
  sourceHash: string;
  tokenEstimate?: number | null;
  expiresAt?: string | null;
};

export function shouldRegenerateSummary(
  sourceHash: string,
  existingSummary: Pick<StoredContextSummary, "sourceHash" | "expiresAt"> | null
): boolean {
  if (!existingSummary) return true;
  if (existingSummary.sourceHash !== sourceHash) return true;
  const expiresAt = existingSummary.expiresAt ? Date.parse(existingSummary.expiresAt) : null;
  if (expiresAt && Number.isFinite(expiresAt) && expiresAt < Date.now()) return true;
  return false;
}

export async function getContextSummary(
  entityType: ContextSummaryEntityType,
  entityId: string,
  summaryType: string,
  tenantId?: string | null
): Promise<StoredContextSummary | null> {
  const supabase = getSupabaseAdminClient();
  const query = supabase
    .from("context_summaries")
    .select(
      "id, tenant_id, entity_type, entity_id, summary_type, summary_text, source_hash, token_estimate, expires_at, created_at, updated_at"
    )
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("summary_type", summaryType)
    .order("updated_at", { ascending: false })
    .limit(1);

  const { data, error } =
    tenantId === undefined
      ? await query.maybeSingle()
      : tenantId === null
        ? await query.is("tenant_id", null).maybeSingle()
        : await query.eq("tenant_id", tenantId).maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id as string,
    tenantId: (data.tenant_id as string | null) ?? null,
    entityType: data.entity_type as ContextSummaryEntityType,
    entityId: data.entity_id as string,
    summaryType: data.summary_type as string,
    summaryText: data.summary_text as string,
    sourceHash: data.source_hash as string,
    tokenEstimate: (data.token_estimate as number | null) ?? null,
    expiresAt: (data.expires_at as string | null) ?? null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

export async function upsertContextSummary(input: UpsertContextSummaryInput): Promise<StoredContextSummary | null> {
  const supabase = getSupabaseAdminClient();
  const row = {
    tenant_id: input.tenantId ?? null,
    entity_type: input.entityType,
    entity_id: input.entityId,
    summary_type: input.summaryType,
    summary_text: input.summaryText,
    source_hash: input.sourceHash,
    token_estimate: input.tokenEstimate ?? null,
    expires_at: input.expiresAt ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("context_summaries")
    .upsert(row, {
      onConflict: "tenant_id,entity_type,entity_id,summary_type,source_hash",
    })
    .select(
      "id, tenant_id, entity_type, entity_id, summary_type, summary_text, source_hash, token_estimate, expires_at, created_at, updated_at"
    )
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id as string,
    tenantId: (data.tenant_id as string | null) ?? null,
    entityType: data.entity_type as ContextSummaryEntityType,
    entityId: data.entity_id as string,
    summaryType: data.summary_type as string,
    summaryText: data.summary_text as string,
    sourceHash: data.source_hash as string,
    tokenEstimate: (data.token_estimate as number | null) ?? null,
    expiresAt: (data.expires_at as string | null) ?? null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

export async function getReusableSummary(input: {
  tenantId: string;
  agent: string;
  taskType: string;
  rawContextText: string;
}): Promise<string | null> {
  const sourceHash = hashPrompt(input.rawContextText);
  const entityId = hashPrompt({
    tenantId: input.tenantId,
    agent: input.agent,
    taskType: input.taskType,
  });

  const summary = await getContextSummary("scan_run", entityId, input.taskType, input.tenantId);
  if (shouldRegenerateSummary(sourceHash, summary)) return null;
  return summary?.summaryText ?? null;
}

export async function writeReusableSummary(input: {
  tenantId: string;
  agent: string;
  taskType: string;
  rawContextText: string;
  summaryText: string;
  ttlSeconds?: number;
}): Promise<void> {
  const sourceHash = hashPrompt(input.rawContextText);
  const expiresAt = new Date(Date.now() + (input.ttlSeconds ?? 60 * 60 * 12) * 1000).toISOString();
  const entityId = hashPrompt({
    tenantId: input.tenantId,
    agent: input.agent,
    taskType: input.taskType,
  });

  await upsertContextSummary({
    tenantId: input.tenantId,
    entityType: "scan_run",
    entityId,
    summaryType: input.taskType,
    summaryText: input.summaryText,
    sourceHash,
    tokenEstimate: null,
    expiresAt,
  });
}
