import { inngest } from "@/inngest/client";
import { runExternalDiscoveryScan } from "@/agents/agent1-scanner/externalDiscoveryService";
import { upsertExternalAssets } from "@/repositories/externalAssetsRepository";

export const runExternalDiscovery = inngest.createFunction(
  { id: "run-external-discovery", name: "Agent 1: External Attack Surface Discovery" },
  { event: "securewatch/agent1.external_discovery.requested" },
  async ({ event, step }) => {
    const { scanId, clientId, domain } = event.data as {
      scanId: string;
      clientId?: string;
      domain: string;
    };

    if (!domain || typeof domain !== "string") {
      throw new Error("Invalid payload: domain is required");
    }
    if (!scanId || typeof scanId !== "string") {
      throw new Error("Invalid payload: scanId is required");
    }

    const result = await step.run("discover-assets", async () => {
      return runExternalDiscoveryScan({ scanId, clientId, domain });
    });

    await step.run("persist-assets", async () => {
      const hydratedAssets = result.assets.map((a) => ({
      ...a,
      discoveredAt: new Date(a.discoveredAt),
    }));
    await upsertExternalAssets(hydratedAssets);
    });

    await step.sendEvent("emit-discovered", {
      name: "securewatch/external_assets.discovered",
      data: {
        scanId,
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
