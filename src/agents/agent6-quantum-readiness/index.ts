/**
 * Agent 6: Quantum Risk & Crypto Agility Module
 * Orchestration entry point — pure, testable, side-effect-free.
 */

import type {
  CryptoInventoryItem,
  QuantumReadinessAssessment,
  QuantumRemediationTask,
  QuantumPolicyResult,
  RawScanFinding,
  VendorMetadata,
} from "./types";
import { normalizeCryptoInventory } from "./cryptoInventoryScanner";
import type { ManualAssetPayload } from "./cryptoInventoryScanner";
import { analyzeQuantumRisk } from "./quantumRiskEngine";
import { calculateQuantumReadinessScore } from "./quantumReadinessScoring";
import { generateQuantumRemediationTasks } from "./remediationPlanner";
import { evaluatePolicies, mapToFrameworkControls } from "./policyMapper";
import { evaluateQuantumInventoryOpa, evaluateQuantumVendorOpa } from "./quantumOpaEvaluation";
import { randomUUID } from "node:crypto";

// ── Input / Output ────────────────────────────────────────────────────────────

export type { VendorMetadata } from "./types";

export interface QuantumAssessmentInput {
  clientId: string;
  scanId?: string;
  /** Pre-structured asset payloads (manual / API-sourced). */
  assets?: ManualAssetPayload[];
  /** Raw scan findings from SecureWatch360 scan pipeline. */
  scanFindings?: RawScanFinding[];
  /** Optional vendor PQC metadata for supply-chain assessment. */
  vendorMetadata?: VendorMetadata[];
  options?: AssessmentOptions;
}

export interface AssessmentOptions {
  /** Compliance frameworks to include in control gap mapping. */
  frameworks?: string[];
  /** Suppress per-item tasks for findings below this risk level. */
  minimumRiskLevel?: "critical" | "high" | "medium" | "low";
  /** When false, skip HTTP calls to OPA for quantum packages (defaults to true). */
  enableOpa?: boolean;
}

export interface QuantumAssessmentOutput {
  clientId: string;
  scanId?: string;
  completedAt: string;
  inventory: CryptoInventoryItem[];
  assessment: QuantumReadinessAssessment;
  remediationTasks: QuantumRemediationTask[];
  /** In-process policy results from TypeScript rule engine. */
  policyResults: QuantumPolicyResult[];
  /** Framework control gap mappings. */
  controlMappings: ReturnType<typeof mapToFrameworkControls>;
  meta: AssessmentMeta;
}

export interface AssessmentMeta {
  totalSourcesProcessed: number;
  itemsDiscovered: number;
  itemsEnriched: number;
  tasksGenerated: number;
  policyChecksRun: number;
  /** Count of rows produced by quantum Rego OPA evaluation (crypto + tls + vendor). */
  opaPolicyResultsCount?: number;
  durationMs: number;
}

// ── Orchestration ─────────────────────────────────────────────────────────────

/**
 * Runs a full quantum readiness assessment.
 *
 * Steps:
 *   1. Normalise crypto inventory from all provided sources.
 *   2. Enrich every item with analyzeQuantumRisk().
 *   3. Assign stable inventory UUIDs (for remediation FKs and persistence).
 *   4. Calculate Quantum Readiness Score.
 *   5. Generate remediation tasks.
 *   6. Evaluate in-process policy rules (TypeScript).
 *   7. Optionally evaluate `policies/rego/quantum/*.rego` via OPA when `OPA_BASE_URL` is set.
 *   8. Map findings to compliance framework controls.
 *
 * Persistence is server-only: use `persistQuantumReadinessOutput` from `@/lib/quantumAssessmentPersistence`.
 */
export async function runQuantumReadinessAssessment(
  input: QuantumAssessmentInput,
): Promise<QuantumAssessmentOutput> {
  const startMs = Date.now();
  const { clientId, scanId, assets = [], scanFindings = [], options = {}, vendorMetadata = [] } = input;

  // ── Step 1: Normalise crypto inventory ─────────────────────────────────────

  const sources: Parameters<typeof normalizeCryptoInventory>[0]["sources"] = [];

  if (scanFindings.length > 0) {
    sources.push({ type: "supabase_findings", findings: scanFindings });
  }
  if (assets.length > 0) {
    sources.push({ type: "manual", assets });
  }

  // normalizeCryptoInventory calls analyzeQuantumRisk() on each item internally,
  // so items are already enriched on return.
  const inventory: CryptoInventoryItem[] =
    sources.length > 0
      ? normalizeCryptoInventory({ clientId, scanId, sources })
      : [];

  // ── Step 2: Re-enrich any items not already processed ─────────────────────
  // (normalizeCryptoInventory already enriches; this is a safety guard for
  // callers who pre-built CryptoInventoryItem arrays and passed them directly)
  const enriched = inventory.map((item) =>
    item.vulnerabilityStatus === "unknown" ? analyzeQuantumRisk(item) : item,
  );

  // ── Stable ids for remediation tasks, OPA rows, and Supabase FKs ───────────
  const withIds: CryptoInventoryItem[] = enriched.map((item) => ({
    ...item,
    id: item.id ?? randomUUID(),
  }));

  // ── Step 3: Calculate readiness score ──────────────────────────────────────

  const assessment = calculateQuantumReadinessScore(withIds, clientId, scanId);

  // ── Step 4: Generate remediation tasks ─────────────────────────────────────

  const remediationTasks = generateQuantumRemediationTasks(clientId, assessment, withIds);

  // ── Step 5: Evaluate in-process policy rules ────────────────────────────────

  const tsPolicyResults = evaluatePolicies(withIds, clientId);

  const enableOpa = options.enableOpa !== false;
  const opaInventoryResults = enableOpa ? await evaluateQuantumInventoryOpa(withIds, clientId) : [];
  const opaVendorResults =
    enableOpa && vendorMetadata.length > 0
      ? await evaluateQuantumVendorOpa(vendorMetadata, clientId)
      : [];

  const policyResults: QuantumPolicyResult[] = [...tsPolicyResults, ...opaInventoryResults, ...opaVendorResults];

  // ── Step 6: Map to compliance framework controls ───────────────────────────

  const controlMappings = mapToFrameworkControls(withIds, options.frameworks);

  return {
    clientId,
    scanId,
    completedAt: new Date().toISOString(),
    inventory: withIds,
    assessment,
    remediationTasks,
    policyResults,
    controlMappings,
    meta: {
      totalSourcesProcessed: sources.length,
      itemsDiscovered: inventory.length,
      itemsEnriched: withIds.length,
      tasksGenerated: remediationTasks.length,
      policyChecksRun: policyResults.length,
      opaPolicyResultsCount: opaInventoryResults.length + opaVendorResults.length,
      durationMs: Date.now() - startMs,
    },
  };
}
