/**
 * SecureWatch360 — Posture Roadmap data adapter.
 *
 * Reads existing SecureWatch360 data from Supabase and maps it to the
 * PostureScoringInput shape expected by the scoring engine. All queries
 * run server-side via the admin client and are scoped to tenantId.
 *
 * Tables that don't exist or return no rows produce safe estimated defaults;
 * `isEstimated` is flagged true whenever significant inputs are unknown.
 */

import { getSupabaseAdminClient } from "@/lib/supabase";
import type { PostureScoringInput } from "@/lib/postureScoringService";
import { FRAMEWORK_TYPES } from "@/features/posture-roadmap/types/postureTypes";

// Supabase allSettled result extractors — avoids type-unsafe fake fallback objects
function fromData<T>(r: PromiseSettledResult<{ data: T | null; error: unknown }>): T | null {
  return r.status === "fulfilled" ? r.value.data : null;
}
function fromCount(r: PromiseSettledResult<{ count: number | null; data: unknown; error: unknown }>): number {
  return r.status === "fulfilled" ? (r.value.count ?? 0) : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error types
// ─────────────────────────────────────────────────────────────────────────────

export type PostureRoadmapErrorCode =
  | "TENANT_NOT_FOUND"
  | "ASSESSMENT_NOT_FOUND"
  | "INVALID_FRAMEWORK"
  | "NO_SCAN_DATA"
  | "SUPABASE_ERROR"
  | "UNAUTHORIZED";

export class PostureRoadmapError extends Error {
  readonly code: PostureRoadmapErrorCode;
  readonly cause?: unknown;

  constructor(message: string, code: PostureRoadmapErrorCode, cause?: unknown) {
    super(message);
    this.name = "PostureRoadmapError";
    this.code = code;
    this.cause = cause;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Framework validation
// ─────────────────────────────────────────────────────────────────────────────

const VALID_FRAMEWORK_SET = new Set<string>(FRAMEWORK_TYPES);

export function validateFramework(framework: string): void {
  const normalized = framework.toUpperCase();
  if (!VALID_FRAMEWORK_SET.has(normalized)) {
    throw new PostureRoadmapError(
      `Invalid framework "${framework}". Valid values: ${FRAMEWORK_TYPES.join(", ")}`,
      "INVALID_FRAMEWORK"
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

const SIEM_TYPES = ["siem", "splunk", "elastic", "datadog", "sentinel", "sumo", "logrhythm"];
const LOGGING_TYPES = ["logging", "cloudwatch", "stackdriver", "syslog", "loki"];

function deriveLoggingFlags(integrations: Array<{ integration_type: string }>): {
  siemConnected: boolean;
  centralizedLoggingEnabled: boolean;
} {
  const types = integrations.map((i) => i.integration_type.toLowerCase());
  const siemConnected = types.some((t) => SIEM_TYPES.some((kw) => t.includes(kw)));
  const loggingEnabled = types.some((t) => LOGGING_TYPES.some((kw) => t.includes(kw)));
  return { siemConnected, centralizedLoggingEnabled: siemConnected || loggingEnabled };
}

const ENDPOINT_ASSET_TYPES = new Set(["endpoint", "workstation", "laptop", "desktop", "server"]);

function countEdrAndEncryption(
  inventory: Array<{ asset_type: string; metadata: Record<string, unknown> | null }>
): { edrCovered: number; encryptionCovered: number; endpointTotal: number } {
  const endpoints = inventory.filter((a) =>
    ENDPOINT_ASSET_TYPES.has((a.asset_type ?? "").toLowerCase())
  );
  const edrCovered = endpoints.filter((a) => {
    const m = a.metadata ?? {};
    return m["edr_status"] === "active" || m["edr_installed"] === true;
  }).length;
  const encryptionCovered = endpoints.filter((a) => {
    const m = a.metadata ?? {};
    return m["disk_encryption"] === true || m["encryption_status"] === "enabled";
  }).length;
  return { edrCovered, encryptionCovered, endpointTotal: endpoints.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// buildPostureScoringInput
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Queries all available SecureWatch360 tables for the given tenant and builds
 * a PostureScoringInput. Fields with no DB backing are set to safe defaults
 * and the result is flagged as estimated.
 *
 * Throws PostureRoadmapError with code TENANT_NOT_FOUND when the tenant
 * does not exist. All other query failures are caught and produce estimated
 * defaults rather than throwing.
 */
export async function buildPostureScoringInput(
  tenantId: string,
  _clientId?: string
): Promise<PostureScoringInput> {
  const supabase = getSupabaseAdminClient();

  // ── Tenant guard ────────────────────────────────────────────────────────────
  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .select("id, sso_enforced")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantErr) {
    throw new PostureRoadmapError(
      `Failed to look up tenant ${tenantId}: ${tenantErr.message}`,
      "SUPABASE_ERROR",
      tenantErr
    );
  }
  if (!tenant) {
    throw new PostureRoadmapError(`Tenant ${tenantId} not found`, "TENANT_NOT_FOUND");
  }

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  // ── Parallel queries — all are individually fallible ────────────────────────
  const [
    findingsRes,
    scanTargetsRes,
    assetInventoryRes,
    userCountRes,
    recentScanRunsRes,
    controlMappingsRes,
    totalControlsRes,
    evidenceCountRes,
    auditLogCountRes,
    integrationsRes,
  ] = await Promise.allSettled([
    supabase
      .from("findings")
      .select("id, severity, category, asset_type, exposure, status, priority_score, created_at")
      .eq("tenant_id", tenantId)
      .not("status", "in", '("resolved","risk_accepted","false_positive")')
      .order("priority_score", { ascending: false })
      .limit(500),

    supabase
      .from("scan_targets")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "active"),

    supabase
      .from("asset_inventory")
      .select("id, asset_type, metadata")
      .eq("tenant_id", tenantId),

    supabase
      .from("tenant_users")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),

    supabase
      .from("scan_runs")
      .select("scan_target_id")
      .eq("tenant_id", tenantId)
      .eq("status", "succeeded")
      .gte("completed_at", thirtyDaysAgo),

    supabase
      .from("finding_control_mappings")
      .select("control_requirement_id")
      .eq("tenant_id", tenantId),

    supabase
      .from("control_requirements")
      .select("id", { count: "exact", head: true }),

    supabase
      .from("evidence_records")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),

    supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", sevenDaysAgo),

    supabase
      .from("integration_configs")
      .select("integration_type")
      .eq("tenant_id", tenantId)
      .eq("enabled", true),
  ]);

  // ── Unpack results with fallbacks ───────────────────────────────────────────
  const findings = fromData(findingsRes) ?? [];
  const scanTargets = fromData(scanTargetsRes) ?? [];
  const assetInventory = fromData(assetInventoryRes) ?? [];
  const totalUsers = fromCount(userCountRes);
  const recentScanRuns = fromData(recentScanRunsRes) ?? [];
  const controlMappings = fromData(controlMappingsRes) ?? [];
  const totalControls = fromCount(totalControlsRes);
  const evidenceCount = fromCount(evidenceCountRes);
  const auditLogCount = fromCount(auditLogCountRes);
  const integrations = fromData(integrationsRes) ?? [];

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const totalAssets = Math.max(scanTargets.length, assetInventory.length);

  const internetExposedAssets = findings.filter(
    (f) => f.exposure === "internet" || f.exposure === "external"
  ).length;

  const { edrCovered, encryptionCovered } = countEdrAndEncryption(
    assetInventory as Array<{ asset_type: string; metadata: Record<string, unknown> | null }>
  );

  const recentScanTargetIds = new Set(recentScanRuns.map((r) => r.scan_target_id));
  const assetsWithRecentScan = scanTargets.filter((t) => recentScanTargetIds.has(t.id)).length;

  const criticalVulnsOpenOver7Days = findings.filter(
    (f) => f.severity === "critical" && (f.created_at ?? "") < sevenDaysAgo
  ).length;
  const highVulnsOpenOver30Days = findings.filter(
    (f) => f.severity === "high" && (f.created_at ?? "") < thirtyDaysAgo
  ).length;

  const distinctControlsMapped = new Set(controlMappings.map((m) => m.control_requirement_id))
    .size;

  const { siemConnected, centralizedLoggingEnabled: loggingFromIntegrations } = deriveLoggingFlags(
    integrations as Array<{ integration_type: string }>
  );
  const auditLoggingEnabled = auditLogCount > 0;
  const centralizedLoggingEnabled = loggingFromIntegrations || auditLoggingEnabled;

  // Fields with no DB backing — all estimated
  // isEstimated = true when MFA, backup, and training data are all unknown (which they always are
  // unless overridden) OR when we have no asset / user data to anchor the score.
  const missingCriticalData = totalAssets === 0 && totalUsers === 0;
  const isEstimated = true; // MFA / backup / training have no DB backing; always flag estimated

  const openFindings = findings.map((f) => ({
    id: f.id as string,
    severity: f.severity as "critical" | "high" | "medium" | "low" | "info",
    category: f.category as string | null,
    assetType: f.asset_type as string,
    exposure: f.exposure as string,
    status: f.status as string,
    priorityScore: (f.priority_score as number) ?? 0,
  }));

  if (openFindings.length === 0 && totalAssets === 0) {
    // Emit a soft warning via isEstimated; do NOT throw — caller decides what to do.
    void missingCriticalData; // already captured in isEstimated
  }

  return {
    tenantId,
    openFindings,
    totalAssets,
    internetExposedAssets,
    endpointsCoveredByEdr: edrCovered,
    endpointsWithDiskEncryption: encryptionCovered,
    totalUsers,
    // MFA state: no DB table — all unknown, scoring engine treats 0/0 as worst-case
    usersWithMfaEnabled: 0,
    privilegedUsersWithMfa: 0,
    totalPrivilegedUsers: 0,
    ssoEnabled: (tenant as { sso_enforced: boolean }).sso_enforced ?? false,
    assetsWithRecentScan,
    criticalVulnsOpenOver7Days,
    highVulnsOpenOver30Days,
    // Backup state: no DB table — default false (worst-case)
    backupConfigured: false,
    backupTestedRecently: false,
    offsiteBackupEnabled: false,
    immutableBackupEnabled: false,
    centralizedLoggingEnabled,
    auditLoggingEnabled,
    siemConnected,
    controlsMapped: distinctControlsMapped,
    totalControls,
    evidenceArtifactsUploaded: evidenceCount,
    // Training / IRP: no DB table — default false / 0
    sspDocumented: false,
    trainingCompletionPercent: 0,
    phishingSimulationActive: false,
    lastTrainingDate: null,
    irpDocumented: false,
    irpTestedRecently: false,
    breachNotificationProcedure: false,
    isEstimated,
  };
}
