import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AssetInventoryTable } from "@/components/assets/AssetInventoryTable";

export const metadata = { title: "Asset Inventory — SecureWatch360" };

export default async function AssetsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Asset Inventory</h1>
        <p className="mt-1 text-sm text-gray-500">
          All discovered assets grouped by type, sorted by finding severity.
        </p>
      </div>
      <AssetInventoryTable />
    </div>
  );
}
