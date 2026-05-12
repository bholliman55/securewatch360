import { inngest } from "@/inngest/client";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { generateThreatDigest } from "@/lib/threatDigestGenerator";

export const generateThreatDigestFunction = inngest.createFunction(
  { id: "generate-threat-digest", name: "Threat Digest: Weekly AI Summary" },
  [
    { cron: "0 8 * * 1" }, // Every Monday 08:00 UTC
    { event: "securewatch/threat.digest.requested" },
  ],
  async ({ event, step }) => {
    const supabase = getSupabaseAdminClient();

    const tenantIds: string[] = await step.run("get-tenant-ids", async () => {
      if (event.name === "securewatch/threat.digest.requested") {
        return [(event.data as { tenantId: string }).tenantId];
      }
      const { data } = await supabase.from("tenants").select("id");
      return (data ?? []).map((t) => t.id as string);
    });

    const results: { tenantId: string; ok: boolean }[] = [];

    for (const tenantId of tenantIds) {
      await step.run(`digest-${tenantId}`, async () => {
        const digest = await generateThreatDigest(tenantId);

        await supabase.from("tenant_threat_digests").upsert(
          {
            tenant_id: tenantId,
            digest,
            generated_at: digest.generatedAt,
          },
          { onConflict: "tenant_id" }
        );

        await supabase.from("audit_logs").insert({
          tenant_id: tenantId,
          action: "threat_digest.generated",
          actor_user_id: null,
          resource_type: "threat_digest",
          resource_id: tenantId,
          metadata: { findingCount: digest.topFindings.length },
        });

        results.push({ tenantId, ok: true });
      });
    }

    return { processed: results.length };
  }
);
