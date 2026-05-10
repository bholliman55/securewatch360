/**
 * Remediation safety guardrails — policy gates, risk scoring, environment matrix,
 * and simulation/demo protections. Does not perform remediation; callers enforce.
 */

import { evaluateGuardrails } from "@/lib/guardrails";
import type { DecisionOutput } from "@/types/policy";
import type { RemediationActionType } from "@/types/remediation";
import type { GuardrailOutcome } from "@/lib/guardrails";

/** Logical deployment slice used for autonomous remediation policy. */
export type RemediationDeploymentEnvironment =
  | "production"
  | "staging"
  | "simulation"
  | "demo";

/** High-touch remediation classes that must never run autonomously without human approval. */
export type HighRiskRemediationCategory =
  | "account_disable"
  | "network_isolation"
  | "firewall_change"
  | "policy_deployment"
  | "endpoint_quarantine"
  | "resource_delete";

export type RemediationMatrixDecision = "allow" | "deny" | "approval_required";

export type RemediationPolicyGateInput = Pick<
  DecisionOutput,
  "action" | "requiresApproval" | "autoRemediationAllowed" | "riskAcceptanceAllowed"
>;

export type RemediationSafetyInput = {
  deploymentEnvironment: RemediationDeploymentEnvironment;
  actionType: RemediationActionType;
  severity: "info" | "low" | "medium" | "high" | "critical";
  exposure: "internet" | "external" | "partner" | "internal" | "isolated" | "unknown";
  targetType: string;
  title: string;
  category: string | null;
  policyDecision: RemediationPolicyGateInput;
  /** When true, treat run as synthetic (e.g. simulator / investor demo) regardless of NODE_ENV. */
  simulationContext?: boolean;
};

export type RemediationSafetyEvaluation = {
  approval_required: boolean;
  rollback_supported: boolean;
  remediation_risk_score: number;
  remediation_timeout_seconds: number;
  blocked: boolean;
  matrix_decision: RemediationMatrixDecision;
  matched_high_risk_categories: HighRiskRemediationCategory[];
  deployment_environment: RemediationDeploymentEnvironment;
  simulation_live_execution_blocked: boolean;
  policy_gate_outcome: GuardrailOutcome;
  reasons: string[];
};

const ALL_HIGH_RISK: HighRiskRemediationCategory[] = [
  "account_disable",
  "network_isolation",
  "firewall_change",
  "policy_deployment",
  "endpoint_quarantine",
  "resource_delete",
];

/**
 * Allow/deny matrix: autonomous / unattended remediation posture per environment × category.
 * `approval_required` = human must approve before any live execution.
 * `deny` = autonomous path is forbidden (routing should not queue automatic execution).
 */
export const REMEDIATION_AUTONOMY_MATRIX: Record<
  RemediationDeploymentEnvironment,
  Record<HighRiskRemediationCategory, RemediationMatrixDecision>
> = {
  production: {
    account_disable: "approval_required",
    network_isolation: "approval_required",
    firewall_change: "approval_required",
    policy_deployment: "approval_required",
    endpoint_quarantine: "approval_required",
    resource_delete: "approval_required",
  },
  staging: {
    account_disable: "approval_required",
    network_isolation: "approval_required",
    firewall_change: "approval_required",
    policy_deployment: "approval_required",
    endpoint_quarantine: "approval_required",
    resource_delete: "approval_required",
  },
  simulation: {
    account_disable: "deny",
    network_isolation: "deny",
    firewall_change: "deny",
    policy_deployment: "deny",
    endpoint_quarantine: "deny",
    resource_delete: "deny",
  },
  demo: {
    account_disable: "deny",
    network_isolation: "deny",
    firewall_change: "deny",
    policy_deployment: "deny",
    endpoint_quarantine: "deny",
    resource_delete: "deny",
  },
};

function readEnv(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const v = env[key];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

/**
 * Resolve deployment environment from process env (server-side).
 * Precedence: SW360_DEPLOYMENT_ENV → VERCEL_ENV / NEXT_PUBLIC_VERCEL_ENV → INVESTOR_DEMO_MODE → NODE_ENV.
 */
export function resolveRemediationDeploymentEnvironment(
  env: NodeJS.ProcessEnv = process.env
): RemediationDeploymentEnvironment {
  const explicit = readEnv(env, "SW360_DEPLOYMENT_ENV")?.toLowerCase();
  if (explicit === "production" || explicit === "prod") return "production";
  if (explicit === "staging" || explicit === "preview") return "staging";
  if (explicit === "simulation" || explicit === "sim") return "simulation";
  if (explicit === "demo") return "demo";

  const vercel = (
    readEnv(env, "VERCEL_ENV") ??
    readEnv(env, "NEXT_PUBLIC_VERCEL_ENV") ??
    ""
  ).toLowerCase();
  if (vercel === "production") return "production";
  if (vercel === "preview") return "staging";

  const demoFlag = readEnv(env, "INVESTOR_DEMO_MODE") ?? readEnv(env, "NEXT_PUBLIC_INVESTOR_DEMO_MODE");
  if (demoFlag === "1" || demoFlag?.toLowerCase() === "true") return "demo";

  const nodeEnv = readEnv(env, "NODE_ENV")?.toLowerCase();
  if (nodeEnv === "production") return "production";
  if (nodeEnv === "test") return "simulation";
  return "staging";
}

/** Maps deployment bucket to legacy guardrail `environment` discriminator. */
export function deploymentToGuardrailEnvironment(
  d: RemediationDeploymentEnvironment
): "dev" | "staging" | "prod" | "simulation" | "demo" | "unknown" {
  switch (d) {
    case "production":
      return "prod";
    case "staging":
      return "staging";
    case "simulation":
      return "simulation";
    case "demo":
      return "demo";
    default:
      return "unknown";
  }
}

/**
 * Infer high-risk remediation categories from action type plus finding text.
 */
export function inferHighRiskRemediationCategories(args: {
  actionType: RemediationActionType;
  title: string;
  category: string | null;
}): HighRiskRemediationCategory[] {
  const text = `${args.category ?? ""} ${args.title}`.toLowerCase();
  const found = new Set<HighRiskRemediationCategory>();

  if (args.actionType === "isolate") {
    found.add("network_isolation");
    found.add("endpoint_quarantine");
  }

  if (
    /\b(quarantine|isolate|air[-\s]?gap)\b/.test(text) ||
    args.actionType === "isolate"
  ) {
    found.add("endpoint_quarantine");
    if (!found.has("network_isolation") && /\b(network|vlan|segment)\b/.test(text)) {
      found.add("network_isolation");
    }
  }

  if (/\b(firewall|security group|sg\b|nsg|iptables|waf rule)\b/.test(text)) {
    found.add("firewall_change");
  }

  if (
    /\b(policy deploy|deploy policy|opa bundle|rego bundle|policy pack|iac policy)\b/.test(text) ||
    (/\bpolicy\b/.test(text) && /\b(deploy|push|publish)\b/.test(text))
  ) {
    found.add("policy_deployment");
  }

  if (
    /\b(disable account|lock account|suspend user|revoke access|deprovision user|aad disable)\b/.test(
      text
    )
  ) {
    found.add("account_disable");
  }

  if (
    /\b(delete|destroy|terminate|purge bucket|drop table|remove resource|obliterate)\b/.test(text)
  ) {
    found.add("resource_delete");
  }

  if (args.actionType === "config_change" && found.size === 0) {
    if (/\b(firewall|acl|sg\b|security group)\b/.test(text)) found.add("firewall_change");
    if (/\b(policy|opa|rego)\b/.test(text)) found.add("policy_deployment");
  }

  return ALL_HIGH_RISK.filter((c) => found.has(c));
}

function severityBaseScore(severity: RemediationSafetyInput["severity"]): number {
  switch (severity) {
    case "critical":
      return 42;
    case "high":
      return 32;
    case "medium":
      return 20;
    case "low":
      return 10;
    default:
      return 4;
  }
}

function categoryRiskWeight(c: HighRiskRemediationCategory): number {
  switch (c) {
    case "resource_delete":
      return 18;
    case "account_disable":
      return 16;
    case "endpoint_quarantine":
    case "network_isolation":
      return 14;
    case "firewall_change":
      return 13;
    case "policy_deployment":
      return 12;
    default:
      return 10;
  }
}

function rollupMatrixDecision(
  env: RemediationDeploymentEnvironment,
  categories: HighRiskRemediationCategory[]
): RemediationMatrixDecision {
  if (categories.length === 0) return "allow";
  let worst: RemediationMatrixDecision = "allow";
  const rank: Record<RemediationMatrixDecision, number> = {
    allow: 0,
    approval_required: 1,
    deny: 2,
  };
  for (const c of categories) {
    const cell = REMEDIATION_AUTONOMY_MATRIX[env][c];
    if (rank[cell] > rank[worst]) worst = cell;
  }
  return worst;
}

function computeRollbackSupported(
  actionType: RemediationActionType,
  categories: HighRiskRemediationCategory[]
): boolean {
  if (actionType === "notify" || actionType === "ticket" || actionType === "manual_fix") return true;
  if (categories.some((c) => c === "resource_delete" || c === "account_disable")) return false;
  if (actionType === "isolate" || categories.includes("network_isolation")) return false;
  if (categories.includes("firewall_change") || categories.includes("policy_deployment")) return false;
  return true;
}

function computeTimeoutSeconds(riskScore: number, actionType: RemediationActionType): number {
  let t = 300 + Math.round(riskScore * 45);
  if (actionType === "isolate") t = Math.max(t, 1800);
  t = Math.min(Math.max(t, 60), 7200);
  return t;
}

function isLiveExecutionExplicitlyUnlocked(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = readEnv(env, "REMEDIATION_ALLOW_LIVE_IN_SIMULATION_DEMO")?.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * When true, shell/API remediation must not run with dryRun=false in simulation or demo deployments.
 */
export function isSimulationLiveExecutionBlocked(
  deployment: RemediationDeploymentEnvironment,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (deployment !== "simulation" && deployment !== "demo") return false;
  return !isLiveExecutionExplicitlyUnlocked(env);
}

/**
 * Throws if live remediation execution is not permitted for this deployment.
 */
export function assertLiveRemediationExecutionAllowed(args: {
  deployment: RemediationDeploymentEnvironment;
  dryRun: boolean;
  actionType: string;
  title?: string;
  category?: string | null;
  env?: NodeJS.ProcessEnv;
}): void {
  if (args.dryRun) return;
  if (!isSimulationLiveExecutionBlocked(args.deployment, args.env ?? process.env)) return;

  const categories = inferHighRiskRemediationCategories({
    actionType: args.actionType as RemediationActionType,
    title: args.title ?? "",
    category: args.category ?? null,
  });

  throw new Error(
    `Live remediation execution is blocked in ${args.deployment} deployment (dryRun=false). ` +
      `Matched risk categories: ${categories.length ? categories.join(", ") : "none (still blocked in sim/demo)"}. ` +
      `Use dry-run, or set REMEDIATION_ALLOW_LIVE_IN_SIMULATION_DEMO=true only in controlled lab settings.`
  );
}

/**
 * Primary entry: combines policy guardrails, autonomy matrix, risk score, timeouts, rollback hints.
 */
export function evaluateRemediationSafety(input: RemediationSafetyInput): RemediationSafetyEvaluation {
  const reasons: string[] = [];
  const deployment = input.simulationContext ? "simulation" : input.deploymentEnvironment;

  const categories = inferHighRiskRemediationCategories({
    actionType: input.actionType,
    title: input.title,
    category: input.category,
  });

  const guard = evaluateGuardrails({
    targetType: input.targetType,
    environment: deploymentToGuardrailEnvironment(deployment),
    severity: input.severity,
    actionType: input.actionType,
    exposure: input.exposure,
    policyDecision: input.policyDecision,
  });

  const matrixDecision = rollupMatrixDecision(deployment, categories);

  let blocked = guard.outcome === "blocked";
  if (matrixDecision === "deny") {
    blocked = true;
    reasons.push("autonomy_matrix_denies_unattended_execution_in_this_environment");
  }
  for (const r of guard.reasons) reasons.push(`guardrail:${r}`);

  const policyRequiresApproval =
    input.policyDecision.requiresApproval === true || guard.outcome === "approval_required";

  const matrixRequiresApproval = matrixDecision === "approval_required";
  const highRiskCategoryGate = categories.length > 0 && matrixDecision !== "allow";

  const approval_required =
    policyRequiresApproval ||
    matrixRequiresApproval ||
    highRiskCategoryGate ||
    categories.length > 0 ||
    blocked;

  if (policyRequiresApproval) reasons.push("policy_approval_gate");
  if (matrixRequiresApproval) reasons.push("matrix_approval_required");
  if (categories.length > 0) reasons.push(`high_risk_categories:${categories.join(",")}`);

  let remediation_risk_score = severityBaseScore(input.severity);
  if (input.exposure === "internet" || input.exposure === "external") {
    remediation_risk_score += 8;
    reasons.push("exposure_external");
  }
  for (const c of categories) remediation_risk_score += categoryRiskWeight(c);
  if (deployment === "production") remediation_risk_score += 12;
  else if (deployment === "staging") remediation_risk_score += 6;
  if (deployment === "simulation" || deployment === "demo") remediation_risk_score += 4;

  remediation_risk_score = Math.min(100, Math.round(remediation_risk_score));

  const rollback_supported = computeRollbackSupported(input.actionType, categories);
  const remediation_timeout_seconds = computeTimeoutSeconds(remediation_risk_score, input.actionType);

  const simulation_live_execution_blocked = isSimulationLiveExecutionBlocked(deployment);

  return {
    approval_required,
    rollback_supported,
    remediation_risk_score,
    remediation_timeout_seconds,
    blocked,
    matrix_decision: matrixDecision,
    matched_high_risk_categories: categories,
    deployment_environment: deployment,
    simulation_live_execution_blocked,
    policy_gate_outcome: guard.outcome,
    reasons: Array.from(new Set(reasons)),
  };
}
