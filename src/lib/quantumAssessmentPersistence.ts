import { getSupabaseAdminClient } from "@/lib/supabase";
import type { QuantumAssessmentOutput } from "@/agents/agent6-quantum-readiness";
import type {
  CryptoInventoryItem,
  QuantumReadinessAssessment,
  QuantumRemediationTask,
  QuantumPolicyResult,
} from "@/agents/agent6-quantum-readiness/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseOptionalUuid(value: string | undefined | null): string | null {
  if (!value || typeof value !== "string") return null;
  const t = value.trim();
  return UUID_RE.test(t) ? t : null;
}

function requireTenantUuid(label: string, clientId: string): string {
  const u = parseOptionalUuid(clientId);
  if (!u) throw new Error(`${label} must be a valid UUID`);
  return u;
}

function parseTimestamp(value: string | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const d = Date.parse(value);
  return Number.isFinite(d) ? new Date(d).toISOString() : null;
}

function inventoryRow(item: CryptoInventoryItem, clientId: string): Record<string, unknown> {
  const id = parseOptionalUuid(item.id);
  if (!id) throw new Error("Each inventory item must have a persisted id before insert");

  return {
    id,
    client_id: clientId,
    asset_id: parseOptionalUuid(item.assetId),
    scan_id: parseOptionalUuid(item.scanId),
    asset_hostname: item.assetHostname ?? null,
    asset_ip: item.assetIp ?? null,
    asset_type: item.assetType ?? null,
    service_name: item.serviceName ?? null,
    port: item.port ?? null,
    protocol: item.protocol ?? null,
    crypto_usage: item.cryptoUsage,
    algorithm: item.algorithm,
    key_length: item.keyLength ?? null,
    certificate_subject: item.certificateSubject ?? null,
    certificate_issuer: item.certificateIssuer ?? null,
    certificate_expiration: parseTimestamp(item.certificateExpiration),
    tls_version: item.tlsVersion ?? null,
    is_quantum_vulnerable: item.isQuantumVulnerable,
    quantum_risk_level: item.quantumRiskLevel,
    discovery_source: item.discoverySource ?? "agent6",
    evidence: item.evidence ?? {},
  };
}

function assessmentRow(a: QuantumReadinessAssessment, clientId: string): Record<string, unknown> {
  return {
    client_id: clientId,
    scan_id: parseOptionalUuid(a.scanId),
    readiness_score: a.readinessScore,
    total_crypto_assets: a.totalCryptoAssets,
    vulnerable_crypto_assets: a.vulnerableCryptoAssets,
    high_risk_assets: a.highRiskAssets,
    medium_risk_assets: a.mediumRiskAssets,
    low_risk_assets: a.lowRiskAssets,
    harvest_now_decrypt_later_exposure: a.harvestNowDecryptLaterExposure,
    recommended_priority: a.recommendedPriority,
    summary: a.summary ?? null,
  };
}

async function insertInChunks<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  chunkSize: number,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw new Error(`Failed to insert ${table}: ${error.message}`);
  }
}

export type PersistQuantumAssessmentOutcome = {
  assessmentId: string;
  insertedInventoryIds: number;
  insertedTasks: number;
  insertedPolicies: number;
};

/**
 * Writes Agent 6 assessment output using the Supabase **service role** client.
 * Call only from trusted server contexts (API routes, Inngest, jobs).
 */
export async function persistQuantumReadinessOutput(
  output: QuantumAssessmentOutput,
): Promise<PersistQuantumAssessmentOutcome> {
  const clientId = requireTenantUuid("clientId / tenantId", output.clientId);
  const supabase = getSupabaseAdminClient();

  const { data: insAssess, error: assessErr } = await supabase
    .from("quantum_readiness_assessments")
    .insert(assessmentRow(output.assessment, clientId))
    .select("id")
    .single();

  if (assessErr || !insAssess?.id) {
    throw new Error(`quantum_readiness_assessments insert failed: ${assessErr?.message ?? "no id"}`);
  }

  const assessmentId = insAssess.id as string;

  const invRows = output.inventory.map((item) => inventoryRow(item, clientId));
  if (invRows.length > 0) {
    await insertInChunks("quantum_crypto_inventory", invRows, 150);
  }

  const inventoryIdSet = new Set(output.inventory.map((i) => parseOptionalUuid(i.id)).filter(Boolean) as string[]);

  const taskRows = output.remediationTasks.map((t: QuantumRemediationTask) => {
    const invFk = parseOptionalUuid(t.inventoryId ?? undefined);
    return {
      client_id: clientId,
      assessment_id: assessmentId,
      inventory_id: invFk && inventoryIdSet.has(invFk) ? invFk : null,
      title: t.title,
      description: t.description,
      priority: t.priority,
      recommended_action: t.recommendedAction,
      target_standard: t.targetStandard ?? null,
      estimated_effort: t.estimatedEffort ?? null,
      status: t.status,
    };
  });

  if (taskRows.length > 0) {
    await insertInChunks("quantum_remediation_tasks", taskRows, 150);
  }

  const policyRows = output.policyResults.map((p: QuantumPolicyResult) => {
    const invFk = parseOptionalUuid(p.inventoryId ?? undefined);
    return {
      client_id: clientId,
      inventory_id: invFk && inventoryIdSet.has(invFk) ? invFk : null,
      policy_id: p.policyId,
      policy_name: p.policyName,
      passed: p.passed,
      severity: p.severity,
      message: p.message,
      evidence: p.evidence ?? {},
    };
  });

  if (policyRows.length > 0) {
    await insertInChunks("quantum_policy_results", policyRows, 200);
  }

  return {
    assessmentId,
    insertedInventoryIds: output.inventory.length,
    insertedTasks: taskRows.length,
    insertedPolicies: policyRows.length,
  };
}
