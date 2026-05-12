import { inngest } from "@/inngest/client";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { runExternalDiscoveryScan } from "@/agents/agent1-scanner/externalDiscoveryService";
import type { ExternalDiscoveryResult } from "@/agents/agent1-scanner/externalDiscoveryTypes";
import { upsertExternalAssets } from "@/repositories/externalAssetsRepository";
import { SCAN_RUN_STATUSES, FINDING_STATUSES } from "@/lib/statuses";

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
      console.info("[agent1.external_discovery] execution started", {
        scan_id: scanId,
        scan_type: "agent1",
        target: domain,
        client_id: clientId ?? null,
        tenant_id: tenantId,
        backend_route_called: "inngest:securewatch/agent1.external_discovery.requested",
      });
      const { error } = await supabase
        .from("scan_runs")
        .update({ status: SCAN_RUN_STATUSES[1] })
        .eq("id", scanId);
      if (error) throw new Error(`Failed to mark Agent 1 scan running: ${error.message}`);
    });

    let result: ExternalDiscoveryResult;

    try {
      result = (await step.run("discover-assets", async () => {
        return runExternalDiscoveryScan({ scanId, clientId, domain });
      })) as unknown as ExternalDiscoveryResult;
    } catch (err) {
      await step.run("mark-failed", async () => {
        const supabase = getSupabaseAdminClient();
        const errorMessage = (err as Error).message;
        await supabase
          .from("scan_runs")
          .update({
            status: SCAN_RUN_STATUSES[3],
            error_message: errorMessage,
            completed_at: new Date().toISOString(),
            result_summary: {
              scanType: "agent1",
              scannerName: "Agent 1: External Discovery",
              configured: false,
              message: "Agent 1 external discovery failed.",
              errorMessage,
            },
          })
          .eq("id", scanId);
        console.error("[agent1.external_discovery] execution failed", {
          scan_id: scanId,
          scan_type: "agent1",
          target: domain,
          client_id: clientId ?? null,
          tenant_id: tenantId,
          backend_route_called: "inngest:securewatch/agent1.external_discovery.requested",
          response_status: "failed",
          error_message: errorMessage,
        });
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
        scan_id: scanId,
        scan_result_id: scanId,
        scan_target_id: null,
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
        status: FINDING_STATUSES[0],
      }));

      const { error } = await supabase.from("findings").insert(findings);
      if (error) throw new Error(`Failed to write Agent 1 findings: ${error.message}`);
    });

    // Mark scan_run succeeded
    await step.run("mark-succeeded", async () => {
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase
        .from("scan_runs")
        .update({
          status: SCAN_RUN_STATUSES[2],
          completed_at: new Date().toISOString(),
          error_message: null,
          scanner_name: "Agent 1: External Discovery",
          scanner_type: "web",
          result_summary: {
            scanType: "agent1",
            scannerName: "Agent 1: External Discovery",
            totalDiscovered: result.totalDiscovered,
            findingsCreated: result.assets.length,
            errors: result.errors,
            message: result.errors.length > 0
              ? "Agent 1 completed with non-fatal discovery errors."
              : "Agent 1 external attack surface discovery completed.",
          },
        })
        .eq("id", scanId);
      if (error) throw new Error(`Failed to mark Agent 1 scan completed: ${error.message}`);
      console.info("[agent1.external_discovery] execution completed", {
        scan_id: scanId,
        scan_type: "agent1",
        target: domain,
        client_id: clientId ?? null,
        tenant_id: tenantId,
        backend_route_called: "inngest:securewatch/agent1.external_discovery.requested",
        response_status: "completed",
      });
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
