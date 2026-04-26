import { buildRemediationContextBundle } from "@/lib/token-optimization/context-builders/remediationContextBuilder";

/**
 * Example usage for Remediation Agent context loading.
 * This loads compact, traceable context from Supabase for gateway prompts.
 */
export async function exampleRemediationContextUsage() {
  const bundle = await buildRemediationContextBundle({
    tenantId: "00000000-0000-0000-0000-000000000000",
    findingId: "11111111-1111-1111-1111-111111111111",
    scanRunId: "22222222-2222-2222-2222-222222222222",
    taskType: "remediation_recommendation_wording",
  });

  return bundle;
}
