import { headers } from "next/headers";
import Link from "next/link";

type IncidentDetail = {
  id: string;
  tenantId: string;
  findingId: string | null;
  title: string;
  state: string;
  rejoinReady: boolean;
};

type IncidentDetailResponse = {
  ok: boolean;
  incident?: IncidentDetail;
  error?: string;
  message?: string;
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tenantId?: string;
  }>;
};

async function getBaseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${protocol}://${host}`;
  return "http://localhost:3000";
}

export default async function IncidentDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { tenantId = "" } = await searchParams;
  const tid = tenantId.trim();

  const data = await (async (): Promise<IncidentDetailResponse> => {
    const baseUrl = await getBaseUrl();
    const res = await fetch(`${baseUrl}/api/incidents/${id}`, { cache: "no-store" });
    return (await res.json()) as IncidentDetailResponse;
  })();

  return (
    <main>
      <h1>Incident</h1>
      <p>
        <Link href={tid ? `/incidents?tenantId=${encodeURIComponent(tid)}` : "/incidents"}>
          ← Incidents
        </Link>
      </p>
      {!data.ok ? <p className="sw-error">{data.error ?? data.message ?? "Failed to load."}</p> : null}
      {data.ok && data.incident ? (
        <section>
          <h2>{data.incident.title}</h2>
          <p>
            <strong>State</strong> {data.incident.state} ·<strong> Rejoin ready</strong>{" "}
            {String(data.incident.rejoinReady)}
          </p>
          <p>
            <strong>ID</strong> <code>{data.incident.id}</code> ·<strong> Tenant</strong>{" "}
            <code>{data.incident.tenantId}</code>
          </p>
          {data.incident.findingId ? (
            <p>
              <strong>Finding</strong> <code>{data.incident.findingId}</code>
            </p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
