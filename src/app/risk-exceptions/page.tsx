import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { RiskExceptionQueue } from "@/components/risk/RiskExceptionQueue";

export const metadata = { title: "Risk Exceptions — SecureWatch360" };

export default async function RiskExceptionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = getSupabaseAdminClient();
  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const canApprove = tenantUser?.role === "owner" || tenantUser?.role === "admin";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Risk Exceptions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review and manage risk acceptance requests for your organization.
          </p>
        </div>
        {canApprove && (
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
            Approver
          </span>
        )}
      </div>
      <RiskExceptionQueue canApprove={canApprove} />
    </div>
  );
}
