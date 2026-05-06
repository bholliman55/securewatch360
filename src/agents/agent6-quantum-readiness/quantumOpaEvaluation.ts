/**
 * Optional OPA evaluation for quantum Rego packages under policies/rego/quantum/.
 * Fail-open when OPA is unreachable or unparsable (matches decision-engine posture).
 */

import type { CryptoInventoryItem, QuantumPolicyResult, QuantumRiskLevel, VendorMetadata } from "./types";

const RISK_LEVELS: QuantumRiskLevel[] = ["critical", "high", "medium", "low", "unknown"];

function isQuantumRiskLevel(v: string): v is QuantumRiskLevel {
  return RISK_LEVELS.includes(v as QuantumRiskLevel);
}

function resolveOpaBaseUrl(): string | null {
  const raw =
    process.env.OPA_BASE_URL ??
    process.env.QUANTUM_OPA_BASE_URL ??
    "";
  const t = raw.trim();
  return t.length > 0 ? t.replace(/\/$/, "") : null;
}

function resolveTimeoutMs(): number {
  const n = Number(process.env.OPA_POLICY_EVAL_TIMEOUT_MS ?? "6000");
  return Number.isFinite(n) ? n : 6000;
}

function authHeaders(): HeadersInit {
  const token = process.env.OPA_POLICY_EVAL_TOKEN ?? process.env.OPA_AUTH_TOKEN ?? "";
  if (typeof token === "string" && token.trim()) {
    return { Authorization: `Bearer ${token.trim()}` };
  }
  return {};
}

type OpaDataResponse = {
  result?: unknown;
};

function coerceResultArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const vals = Object.values(value as Record<string, unknown>);
    if (vals.length > 0 && vals.every((v) => v && typeof v === "object")) return vals;
  }
  return [];
}

function extractResultSet(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object") return [];
  const { result } = payload as OpaDataResponse;
  if (result && typeof result === "object") {
    const inner = result as Record<string, unknown>;
    return coerceResultArray(inner.results);
  }
  return [];
}

async function postOpaPackage(
  baseUrl: string,
  pkgPath: string,
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<unknown[]> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}${pkgPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const json = (await res.json()) as unknown;
    return extractResultSet(json);
  } catch {
    return [];
  } finally {
    clearTimeout(tid);
  }
}

function itemToOpaInput(item: CryptoInventoryItem): Record<string, unknown> {
  return {
    algorithm: item.algorithm,
    keyLength: item.keyLength ?? null,
    tlsVersion: item.tlsVersion ?? null,
    cryptoUsage: item.cryptoUsage ?? null,
    assetType: item.assetType ?? null,
    assetHostname: item.assetHostname ?? null,
    serviceName: item.serviceName ?? null,
    port: item.port ?? null,
    isQuantumVulnerable: item.isQuantumVulnerable ?? false,
    quantumRiskLevel: item.quantumRiskLevel ?? "unknown",
    evidence: item.evidence ?? {},
  };
}

function mapOpaRowToPolicyResult(
  row: Record<string, unknown>,
  clientId: string,
  inventoryId: string | undefined,
  policyPackage: string
): QuantumPolicyResult | null {
  const policyId = typeof row.policy_id === "string" ? row.policy_id.trim() : "";
  if (!policyId) return null;
  const passed = row.passed === true;
  const sevRaw = typeof row.severity === "string" ? row.severity : "unknown";
  const severity: QuantumRiskLevel = isQuantumRiskLevel(sevRaw) ? sevRaw : "unknown";
  const message = typeof row.message === "string" ? row.message : JSON.stringify(row);
  const remediation = typeof row.remediation === "string" ? row.remediation : undefined;
  return {
    clientId,
    inventoryId,
    policyId,
    policyName: `${policyId} (${policyPackage})`,
    passed,
    severity,
    message,
    evidence: {
      source: "opa",
      package: policyPackage,
      ...(remediation ? { remediation } : {}),
    },
  };
}

/**
 * Evaluates crypto + TLS Rego per inventory item when `OPA_BASE_URL` (or `QUANTUM_OPA_BASE_URL`) is set.
 * Returns [] when OPA is not configured or any request fails (fail-open).
 */
export async function evaluateQuantumInventoryOpa(
  items: CryptoInventoryItem[],
  clientId: string
): Promise<QuantumPolicyResult[]> {
  const baseUrl = resolveOpaBaseUrl();
  if (!baseUrl || items.length === 0) return [];

  const timeoutMs = resolveTimeoutMs();
  const out: QuantumPolicyResult[] = [];

  for (const item of items) {
    const invId = item.id;
    const input = itemToOpaInput(item);
    const cryptoRows = await postOpaPackage(
      baseUrl,
      "/v1/data/securewatch/quantum/crypto",
      { input },
      timeoutMs
    );
    for (const raw of cryptoRows) {
      if (!raw || typeof raw !== "object") continue;
      const mapped = mapOpaRowToPolicyResult(
        raw as Record<string, unknown>,
        clientId,
        invId,
        "securewatch.quantum.crypto"
      );
      if (mapped) out.push(mapped);
    }

    const tlsRows = await postOpaPackage(
      baseUrl,
      "/v1/data/securewatch/quantum/tls",
      { input },
      timeoutMs
    );
    for (const raw of tlsRows) {
      if (!raw || typeof raw !== "object") continue;
      const mapped = mapOpaRowToPolicyResult(
        raw as Record<string, unknown>,
        clientId,
        invId,
        "securewatch.quantum.tls"
      );
      if (mapped) out.push(mapped);
    }
  }

  return out;
}

function vendorToOpaInput(v: VendorMetadata): Record<string, unknown> {
  return {
    vendor_name: v.vendorName,
    product_name: v.productName ?? null,
    vendor_pqc_status: v.pqcStatus,
    is_critical_system: v.isCriticalSystem ?? false,
    contact_confirmed_at: v.contactConfirmedAt ?? null,
    nist_pqc_standards_listed: v.nistPqcStandardsListed ?? [],
    uses_classical_crypto: true,
    pqc_target_date: null as string | null,
  };
}

/**
 * Runs `quantum_vendor_readiness_policy.rego` once per vendor row when OPA is configured.
 */
export async function evaluateQuantumVendorOpa(
  vendors: VendorMetadata[],
  clientId: string
): Promise<QuantumPolicyResult[]> {
  const baseUrl = resolveOpaBaseUrl();
  if (!baseUrl || vendors.length === 0) return [];

  const timeoutMs = resolveTimeoutMs();
  const out: QuantumPolicyResult[] = [];

  for (const v of vendors) {
    const rows = await postOpaPackage(
      baseUrl,
      "/v1/data/securewatch/quantum/vendor",
      { input: vendorToOpaInput(v) },
      timeoutMs
    );
    for (const raw of rows) {
      if (!raw || typeof raw !== "object") continue;
      const mapped = mapOpaRowToPolicyResult(
        raw as Record<string, unknown>,
        clientId,
        undefined,
        "securewatch.quantum.vendor"
      );
      if (mapped) out.push(mapped);
    }
  }

  return out;
}
