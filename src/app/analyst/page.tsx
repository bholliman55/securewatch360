import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{
    tenantId?: string;
  }>;
};

export default async function AnalystHomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tenantId = params.tenantId?.trim() ?? "";
  const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
  redirect(`/console/index.html${query}`);
}
