/**
 * Declared deployment topology for SecureWatch360 — drives isolation rules and validation gates.
 */

import { z } from "zod";

export const DEPLOYMENT_MODELS = [
  "saas_multi_tenant",
  "msp_multi_tenant",
  "customer_isolated_tenant",
  "hybrid_collector",
  "on_prem_collector",
  "gov_ready_isolated",
] as const;

export type DeploymentModel = (typeof DEPLOYMENT_MODELS)[number];

export const deploymentModelSchema = z.enum(DEPLOYMENT_MODELS);

/** Declared in environment — defaults to SaaS multi-tenant when unset (local dev). */
export const deploymentProfileSchema = z.object({
  deployment_model: deploymentModelSchema.default("saas_multi_tenant"),
  /** When true, collectors may buffer upstream without holding long-lived production credentials on endpoints. */
  hybrid_collector_enabled: z.boolean().default(false),
  /** Customer-managed collector or gov enclave — no cloud telemetry egress expected. */
  on_prem_collector_only: z.boolean().default(false),
});

export type DeploymentProfile = z.infer<typeof deploymentProfileSchema>;

export function parseDeploymentProfileFromEnv(env: NodeJS.ProcessEnv = process.env): DeploymentProfile {
  const raw = env.SW360_DEPLOYMENT_MODEL?.trim().toLowerCase().replace(/-/g, "_");
  const normalized =
    raw && (DEPLOYMENT_MODELS as readonly string[]).includes(raw) ? (raw as DeploymentModel) : undefined;
  return deploymentProfileSchema.parse({
    deployment_model: normalized ?? "saas_multi_tenant",
    hybrid_collector_enabled: truthyEnv(env.SW360_HYBRID_COLLECTOR_ENABLED),
    on_prem_collector_only: truthyEnv(env.SW360_ON_PREM_COLLECTOR_ONLY),
  });
}

function truthyEnv(v: string | undefined): boolean {
  const t = v?.trim().toLowerCase();
  return t === "1" || t === "true" || t === "yes" || t === "on";
}
