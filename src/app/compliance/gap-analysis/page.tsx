import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GapAnalysisHeatmap } from "@/components/compliance/GapAnalysisHeatmap";

export const metadata = { title: "Gap Analysis — SecureWatch360" };

export default async function GapAnalysisPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Multi-Framework Gap Analysis</h1>
        <p className="mt-1 text-sm text-gray-500">
          Compliance posture across all frameworks — spot controls failing in multiple places at once.
        </p>
      </div>
      <GapAnalysisHeatmap />
    </div>
  );
}
