import { parseDeploymentProfileFromEnv } from "./deploymentMode.schema";
import { getTenantIsolationPolicy } from "./tenantIsolationPolicy";

export type EnvironmentValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  deployment_model: ReturnType<typeof parseDeploymentProfileFromEnv>["deployment_model"];
  tenant_isolation_summary: string;
};

function read(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const v = env[key];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

function isTruthyDemoOrSimulation(env: NodeJS.ProcessEnv): boolean {
  const keys = ["SIMULATION_DEMO_MODE", "INVESTOR_DEMO_MODE", "NEXT_PUBLIC_INVESTOR_DEMO_MODE"] as const;
  for (const k of keys) {
    const v = read(env, k)?.toLowerCase();
    if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  }
  return false;
}

/**
 * Production-like runtime: Next production build, explicit SW360 production, or Vercel production.
 */
export function isProductionLikeDeployment(env: NodeJS.ProcessEnv = process.env): boolean {
  if (read(env, "SW360_SKIP_DEPLOYMENT_VALIDATION")?.toLowerCase() === "true") {
    return false;
  }
  const node = env.NODE_ENV?.toLowerCase();
  const sw = read(env, "SW360_DEPLOYMENT_ENV")?.toLowerCase();
  const vercel = read(env, "VERCEL_ENV")?.toLowerCase();
  if (sw === "production" || sw === "prod") return true;
  if (vercel === "production") return true;
  if (node === "production") return true;
  return false;
}

const CRITICAL_PRODUCTION_SECRETS: { key: string; description: string }[] = [
  { key: "NEXT_PUBLIC_SUPABASE_URL", description: "Supabase project URL for browser + server" },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", description: "Supabase anon key (RLS-enforced client)" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", description: "Supabase service role (server-only)" },
  { key: "INNGEST_SIGNING_KEY", description: "Inngest signing key for /api/inngest" },
  { key: "INNGEST_EVENT_KEY", description: "Inngest event emission key" },
];

function readSupabaseUrl(env: NodeJS.ProcessEnv): string | undefined {
  return read(env, "NEXT_PUBLIC_SUPABASE_URL") ?? read(env, "NEXT_SUPABASE_URL");
}

/**
 * Validates environment variables, demo/prod separation, and deployment profile consistency.
 * Does not exit the process — callers decide how to fail (throw, log, or block startup).
 */
export function validateEnvironmentConfig(env: NodeJS.ProcessEnv = process.env): EnvironmentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const profile = parseDeploymentProfileFromEnv(env);
  const isolation = getTenantIsolationPolicy(profile.deployment_model);

  if (profile.deployment_model === "hybrid_collector" && !profile.hybrid_collector_enabled) {
    warnings.push(
      "SW360_DEPLOYMENT_MODEL=hybrid_collector but SW360_HYBRID_COLLECTOR_ENABLED is not true — confirm collector topology.",
    );
  }

  if (profile.deployment_model === "on_prem_collector" && !profile.on_prem_collector_only) {
    warnings.push("SW360_ON_PREM_COLLECTOR_ONLY=false while model is on_prem_collector — document any cloud-side processing.");
  }

  if (isProductionLikeDeployment(env)) {
    for (const { key, description } of CRITICAL_PRODUCTION_SECRETS) {
      if (key === "NEXT_PUBLIC_SUPABASE_URL" ? !readSupabaseUrl(env) : !read(env, key)) {
        errors.push(`Missing required production secret ${key} (${description}).`);
      }
    }

    if (isTruthyDemoOrSimulation(env)) {
      errors.push(
        "Demo or simulation overlays (SIMULATION_DEMO_MODE / INVESTOR_DEMO_MODE / NEXT_PUBLIC_INVESTOR_DEMO_MODE) must not be enabled in production — they can mix fixture data with live control planes.",
      );
    }

    if (profile.deployment_model === "gov_ready_isolated") {
      if (!read(env, "SW360_GOV_DEPLOYMENT_ACK")) {
        warnings.push(
          "gov_ready_isolated: set SW360_GOV_DEPLOYMENT_ACK=1 after completing region, FIPS, and personnel access review.",
        );
      }
    }
  } else {
    if (!readSupabaseUrl(env)) {
      warnings.push("NEXT_PUBLIC_SUPABASE_URL is unset — local UI and APIs may fail.");
    }
  }

  const tenant_isolation_summary = [
    `model=${profile.deployment_model}`,
    `rls=${isolation.enforce_supabase_rls}`,
    `shared_control_plane=${isolation.shared_control_plane}`,
    `dedicated_data_plane=${isolation.dedicated_tenant_data_plane}`,
    `collector=${isolation.collector_posture}`,
  ].join("; ");

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    deployment_model: profile.deployment_model,
    tenant_isolation_summary,
  };
}

/**
 * Throws an aggregate error when production validation fails — intended for `instrumentation.ts` startup.
 */
export function assertProductionDeploymentConfig(env: NodeJS.ProcessEnv = process.env): void {
  const r = validateEnvironmentConfig(env);
  if (!isProductionLikeDeployment(env)) return;
  if (r.ok) return;
  const msg = ["SecureWatch360 deployment validation failed:", ...r.errors].join("\n");
  throw new Error(msg);
}
