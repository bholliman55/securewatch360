import { Suspense } from "react";
import { Map } from "lucide-react";
import { serverApiFetch } from "@/lib/serverApi";
import { PostureRoadmapClient } from "./PostureRoadmapClient";
import { LoadingState } from "@/components/posture-roadmap/LoadingState";
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
): Promise<PostureRoadmapSummary & { ok: boolean; error?: string; code?: string; hint?: string }> {
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

async function PostureRoadmapContent({ tenantId, targetFramework }: { tenantId: string; targetFramework?: string }) {
  const [summary, roadmapItems] = await Promise.all([
    loadSummary(tenantId, targetFramework),
    loadRoadmapItems(tenantId),
  ]);

  const hasData =
    summary.ok &&
    ((summary.currentState?.maturityScore ?? 0) > 0 ||
      (summary.totalRoadmapItems ?? 0) > 0);

  return (
    <PostureRoadmapClient
      tenantId={tenantId}
      currentState={summary.ok ? (summary.currentState ?? null) : null}
      targetState={summary.ok ? (summary.targetState ?? null) : null}
      gaps={summary.ok ? (summary.gaps ?? []) : []}
      roadmapItems={roadmapItems}
      initialTargetFramework={summary.ok ? (summary.targetState?.targetFramework ?? "") : ""}
      totalRoadmapItems={summary.ok ? (summary.totalRoadmapItems ?? 0) : 0}
      criticalItems={summary.ok ? (summary.criticalItems ?? 0) : 0}
      automationAvailableCount={summary.ok ? (summary.automationAvailableCount ?? 0) : 0}
    />
  );
}

export default async function PostureRoadmapPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenantId = params.tenantId?.trim() ?? "";
  const targetFramework = params.targetFramework?.trim().toUpperCase() || undefined;

  if (!tenantId) {
    return (
      <main>
        <div
          className="rounded-2xl p-8 text-center shadow-xl"
          style={{
            background: "#1e293b",
            border: "1px solid rgba(102,126,234,0.25)",
          }}
        >
          <div className="flex justify-center mb-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
            >
              <Map size={28} className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-2 text-slate-100">Posture Roadmap</h1>
          <p className="text-sm mb-6 text-slate-400">
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

  return (
    <main style={{ maxWidth: "1100px" }}>
      <Suspense fallback={<LoadingState message="Loading posture assessment..." />}>
        <PostureRoadmapContent tenantId={tenantId} targetFramework={targetFramework} />
      </Suspense>
    </main>
  );
}
