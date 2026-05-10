/**
 * Validates Azure Policy evaluation records (effect, compliance state) for policy-as-code verification drills.
 * Does not call Azure APIs — operates on stored or simulated evaluation payloads.
 */

export const AZURE_POLICY_EFFECTS = [
  "Audit",
  "Deny",
  "Modify",
  "DeployIfNotExists",
  "AuditIfNotExists",
  "Append",
  "Manual",
] as const;

export type AzurePolicyEffect = (typeof AZURE_POLICY_EFFECTS)[number];

export type AzurePolicyEvaluationRecord = {
  policyDefinitionId: string;
  policyDefinitionName: string;
  resourceId: string;
  effect: AzurePolicyEffect;
  complianceState?: "Compliant" | "NonCompliant" | "Unknown";
  initiativeId?: string;
  initiativeName?: string;
};

export type AzurePolicyValidation = {
  ok: boolean;
  errors: string[];
  evaluations: AzurePolicyEvaluationRecord[];
};

const EFFECT_SET = new Set<string>(AZURE_POLICY_EFFECTS);

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function parseRow(row: unknown, index: number): { errors: string[]; record?: AzurePolicyEvaluationRecord } {
  const errors: string[] = [];
  if (!row || typeof row !== "object") {
    return { errors: [`row ${index}: must be object`] };
  }
  const r = row as Record<string, unknown>;

  if (!isNonEmptyString(r.policyDefinitionId)) errors.push(`row ${index}: policyDefinitionId required`);
  if (!isNonEmptyString(r.policyDefinitionName)) errors.push(`row ${index}: policyDefinitionName required`);
  if (!isNonEmptyString(r.resourceId)) errors.push(`row ${index}: resourceId required`);
  if (typeof r.effect !== "string" || !EFFECT_SET.has(r.effect)) {
    errors.push(`row ${index}: effect must be one of ${AZURE_POLICY_EFFECTS.join(", ")}`);
  }

  const cs = r.complianceState;
  if (
    cs !== undefined &&
    cs !== "Compliant" &&
    cs !== "NonCompliant" &&
    cs !== "Unknown"
  ) {
    errors.push(`row ${index}: complianceState invalid`);
  }

  if (errors.length > 0) return { errors };

  const record: AzurePolicyEvaluationRecord = {
    policyDefinitionId: String(r.policyDefinitionId).trim(),
    policyDefinitionName: String(r.policyDefinitionName).trim(),
    resourceId: String(r.resourceId).trim(),
    effect: r.effect as AzurePolicyEffect,
    ...(cs === "Compliant" || cs === "NonCompliant" || cs === "Unknown"
      ? { complianceState: cs }
      : {}),
    ...(isNonEmptyString(r.initiativeId) ? { initiativeId: String(r.initiativeId).trim() } : {}),
    ...(isNonEmptyString(r.initiativeName) ? { initiativeName: String(r.initiativeName).trim() } : {}),
  };
  return { errors: [], record };
}

/**
 * Validate an array of Azure Policy evaluation rows (simulated or exported).
 */
export function validateAzurePolicyDecisions(value: unknown): AzurePolicyValidation {
  if (!Array.isArray(value)) {
    return { ok: false, errors: ["expected array of Azure Policy evaluations"], evaluations: [] };
  }

  const errors: string[] = [];
  const evaluations: AzurePolicyEvaluationRecord[] = [];

  for (let i = 0; i < value.length; i += 1) {
    const { errors: rowErrors, record } = parseRow(value[i], i);
    if (rowErrors.length > 0) errors.push(...rowErrors);
    else if (record) evaluations.push(record);
  }

  if (errors.length > 0) {
    return { ok: false, errors, evaluations: [] };
  }

  return { ok: true, errors: [], evaluations };
}

/** True if any evaluation uses a blocking or deploy remediation effect. */
export function azureEvaluationsImplyEnforcement(evals: AzurePolicyEvaluationRecord[]): boolean {
  return evals.some((e) => e.effect === "Deny" || e.effect === "Modify" || e.effect === "DeployIfNotExists");
}
