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
} from "./types";
import { normalizeCryptoInventory } from "./cryptoInventoryScanner";
import type { ManualAssetPayload } from "./cryptoInventoryScanner";
import { analyzeQuantumRisk } from "./quantumRiskEngine";
import { calculateQuantumReadinessScore } from "./quantumReadinessScoring";
import { generateQuantumRemediationTasks } from "./remediationPlanner";
import { evaluatePolicies, mapToFrameworkControls } from "./policyMapper";

// ── Input / Output ────────────────────────────────────────────────────────────

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

export interface VendorMetadata {
  vendorName: string;
  productName?: string;
  pqcStatus: "supported" | "roadmap_confirmed" | "evaluating" | "no_roadmap" | "unknown";
  nistPqcStandardsListed?: string[];
  isCriticalSystem?: boolean;
  contactConfirmedAt?: string;
}

export interface AssessmentOptions {
  /** Compliance frameworks to include in control gap mapping. */
  frameworks?: string[];
  /** Suppress per-item tasks for findings below this risk level. */
  minimumRiskLevel?: "critical" | "high" | "medium" | "low";
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
  durationMs: number;
}

// ── Orchestration ─────────────────────────────────────────────────────────────

/**
 * Runs a full quantum readiness assessment.
 *
 * Steps:
 *   1. Normalise crypto inventory from all provided sources.
 *   2. Enrich every item with analyzeQuantumRisk().
 *   3. Calculate Quantum Readiness Score.
 *   4. Generate remediation tasks.
 *   5. Evaluate in-process policy rules.
 *   6. Map findings to compliance framework controls.
 *
 * Returns a pure data structure — no Supabase writes occur here.
 *
 * TODO: Add Supabase persistence layer (write inventory, assessment,
 *       tasks, and policy results to their respective tables).
 * TODO: Add OPA/Rego evaluation via HTTP call to policy agent for
 *       quantum_crypto_policy.rego, quantum_tls_policy.rego, and
 *       quantum_vendor_readiness_policy.rego.
 */
export async function runQuantumReadinessAssessment(
  input: QuantumAssessmentInput,
): Promise<QuantumAssessmentOutput> {
  const startMs = Date.now();
  const { clientId, scanId, assets = [], scanFindings = [], options = {} } = input;

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

  // ── Step 3: Calculate readiness score ──────────────────────────────────────

  const assessment = calculateQuantumReadinessScore(enriched, clientId, scanId);

  // ── Step 4: Generate remediation tasks ─────────────────────────────────────

  const remediationTasks = generateQuantumRemediationTasks(clientId, assessment, enriched);

  // ── Step 5: Evaluate in-process policy rules ───────────────────────────────

  const policyResults = evaluatePolicies(enriched, clientId);

  // ── Step 6: Map to compliance framework controls ───────────────────────────

  const controlMappings = mapToFrameworkControls(enriched, options.frameworks);

  // TODO: OPA evaluation
  // const opaResults = await evaluateOpaPolicy("quantum_crypto_policy", enriched);

  // TODO: Supabase persistence
  // await persistInventory(enriched, clientId, scanId);
  // await persistAssessment(assessment);
  // await persistRemediationTasks(remediationTasks);
  // await persistPolicyResults(policyResults);

  return {
    clientId,
    scanId,
    completedAt: new Date().toISOString(),
    inventory: enriched,
    assessment,
    remediationTasks,
    policyResults,
    controlMappings,
    meta: {
      totalSourcesProcessed: sources.length,
      itemsDiscovered: inventory.length,
      itemsEnriched: enriched.length,
      tasksGenerated: remediationTasks.length,
      policyChecksRun: policyResults.length,
      durationMs: Date.now() - startMs,
    },
  };
}
