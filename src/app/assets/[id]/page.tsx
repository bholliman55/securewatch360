import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AssetDetailClient } from "@/components/assets/AssetDetailClient";

export const metadata = { title: "Asset Detail — SecureWatch360" };

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <AssetDetailClient assetId={id} />
    </div>
  );
}
