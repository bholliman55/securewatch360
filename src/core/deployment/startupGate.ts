import { assertProductionDeploymentConfig, isProductionLikeDeployment, validateEnvironmentConfig } from "./environmentConfigValidator";

/**
 * Next.js `instrumentation` hook entry — skips Edge runtime.
 */
export function runDeploymentStartupGate(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NEXT_RUNTIME === "edge") return;
  assertProductionDeploymentConfig(env);
  const r = validateEnvironmentConfig(env);
  if (isProductionLikeDeployment(env) && r.warnings.length > 0) {
    console.warn("[SecureWatch360 deployment warnings]\n", r.warnings.join("\n"));
  }
}
