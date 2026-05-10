import { serverApiFetch } from "@/lib/serverApi";
import { PostureRoadmapClient } from "./PostureRoadmapClient";
import type { PostureRoadmapSummary } from "@/types/posture-roadmap";

type PageProps = {
  searchParams: Promise<{
    tenantId?: string;
    targetFramework?: string;
  }>;
};

async function loadSummary(
  tenantId: string,
  targetFramework?: string
): Promise<PostureRoadmapSummary & { ok: boolean; error?: string }> {
  const params = new URLSearchParams({ tenantId });
  if (targetFramework) params.set("targetFramework", targetFramework);
  const res = await serverApiFetch(`/api/posture-roadmap/summary?${params.toString()}`);
  return res.json();
}

async function loadRoadmapItems(tenantId: string) {
  const res = await serverApiFetch(
    `/api/posture-roadmap/roadmap?tenantId=${encodeURIComponent(tenantId)}`
  );
  const data = await res.json();
  return data.items ?? [];
}

export default async function PostureRoadmapPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenantId = params.tenantId?.trim() ?? "";
  const targetFramework = params.targetFramework?.trim().toUpperCase() || undefined;

  if (!tenantId) {
    return (
      <main>
        <div
          className="rounded-2xl p-8 text-center"
          style={{
            background: "linear-gradient(175deg, #0d1e33 0%, #112d4e 100%)",
            border: "1px solid rgba(41,182,246,0.2)",
          }}
        >
          <p className="text-4xl mb-4">🗺️</p>
          <h1
            className="text-2xl font-bold mb-2"
            style={{ fontFamily: "Rajdhani, Inter, sans-serif", color: "#fff" }}
          >
            Posture Roadmap
          </h1>
          <p className="text-sm mb-6" style={{ color: "#8ab4d4" }}>
            Enter a tenant ID to view your cybersecurity posture roadmap.
          </p>
          <form method="GET" action="/posture-roadmap" className="flex gap-3 max-w-md mx-auto">
            <input
              name="tenantId"
              placeholder="Tenant UUID"
              required
              className="sw-input flex-1"
            />
            <button type="submit" className="sw-button whitespace-nowrap">
              View Roadmap
            </button>
          </form>
        </div>
      </main>
    );
  }

  const [summary, roadmapItems] = await Promise.all([
    loadSummary(tenantId, targetFramework),
    loadRoadmapItems(tenantId),
  ]);

  if (!summary.ok) {
    return (
      <main>
        <div
          className="rounded-2xl p-6"
          style={{ background: "#0d1e33", border: "1px solid rgba(239,68,68,0.3)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "#ef4444" }}>
            Failed to load posture roadmap
          </p>
          <p className="text-xs mt-1" style={{ color: "#8ab4d4" }}>
            {summary.error ?? "Unknown error. Check that the tenant ID is valid and you have access."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: "1100px" }}>
      <PostureRoadmapClient
        tenantId={tenantId}
        currentState={summary.currentState}
        targetState={summary.targetState}
        gaps={summary.gaps}
        roadmapItems={roadmapItems}
        initialTargetFramework={summary.targetState.targetFramework}
        totalRoadmapItems={summary.totalRoadmapItems}
        criticalItems={summary.criticalItems}
        automationAvailableCount={summary.automationAvailableCount}
      />
    </main>
  );
}
