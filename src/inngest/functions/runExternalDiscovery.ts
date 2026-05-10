import { inngest } from "@/inngest/client";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { runExternalDiscoveryScan } from "@/agents/agent1-scanner/externalDiscoveryService";
import type { ExternalDiscoveryResult } from "@/agents/agent1-scanner/externalDiscoveryTypes";
import { upsertExternalAssets } from "@/repositories/externalAssetsRepository";

const ASSET_TYPE_SEVERITY: Record<string, string> = {
  admin_portal: "high",
  login_page: "medium",
  subdomain: "info",
  certificate: "info",
  url: "info",
};

export const runExternalDiscovery = inngest.createFunction(
  { id: "run-external-discovery", name: "Agent 1: External Attack Surface Discovery" },
  { event: "securewatch/agent1.external_discovery.requested" },
  async ({ event, step }) => {
    const { scanId, tenantId, clientId, domain } = event.data as {
      scanId: string;
      tenantId: string;
      clientId?: string;
      domain: string;
    };

    if (!domain || typeof domain !== "string") {
      throw new Error("Invalid payload: domain is required");
    }
    if (!scanId || typeof scanId !== "string") {
      throw new Error("Invalid payload: scanId is required");
    }
    if (!tenantId || typeof tenantId !== "string") {
      throw new Error("Invalid payload: tenantId is required");
    }

    // Mark running
    await step.run("mark-running", async () => {
      const supabase = getSupabaseAdminClient();
      await supabase
        .from("scan_runs")
        .update({ status: "running" })
        .eq("id", scanId);
    });

    let result: ExternalDiscoveryResult;

    try {
      result = (await step.run("discover-assets", async () => {
        return runExternalDiscoveryScan({ scanId, clientId, domain });
      })) as unknown as ExternalDiscoveryResult;
    } catch (err) {
      await step.run("mark-failed", async () => {
        const supabase = getSupabaseAdminClient();
        await supabase
          .from("scan_runs")
          .update({ status: "failed", error_message: (err as Error).message, completed_at: new Date().toISOString() })
          .eq("id", scanId);
      });
      throw err;
    }

    await step.run("persist-assets", async () => {
      const hydratedAssets = result.assets.map((a) => ({
        ...a,
        discoveredAt: new Date(a.discoveredAt),
      }));
      await upsertExternalAssets(hydratedAssets);
    });

    // Write findings so they appear in Scanner + Dashboard
    await step.run("write-findings", async () => {
      if (result.assets.length === 0) return;
      const supabase = getSupabaseAdminClient();
      const findings = result.assets.map((asset) => ({
        tenant_id: tenantId,
        scan_run_id: scanId,
        severity: ASSET_TYPE_SEVERITY[asset.assetType] ?? "info",
        category: "external_attack_surface",
        title: `${asset.assetType.replace(/_/g, " ")}: ${asset.assetValue}`,
        description:
          asset.riskHint ??
          `Discovered via ${asset.source ?? "external discovery"} for domain ${domain}`,
        evidence: {
          assetType: asset.assetType,
          assetValue: asset.assetValue,
          source: asset.source,
          confidence: asset.confidence,
          domain,
        },
        status: "new",
      }));

      await supabase.from("findings").insert(findings);
    });

    // Mark scan_run succeeded
    await step.run("mark-succeeded", async () => {
      const supabase = getSupabaseAdminClient();
      await supabase
        .from("scan_runs")
        .update({ status: "succeeded", completed_at: new Date().toISOString() })
        .eq("id", scanId);
    });

    await step.sendEvent("emit-discovered", {
      name: "securewatch/external_assets.discovered",
      data: {
        scanId,
        tenantId,
        clientId,
        domain,
        totalDiscovered: result.totalDiscovered,
        dedupeCount: result.dedupeCount,
        errors: result.errors,
        completedAt: new Date(result.completedAt).toISOString(),
      },
    });

    return {
      scanId,
      domain,
      totalDiscovered: result.totalDiscovered,
      errors: result.errors,
    };
  }
);
