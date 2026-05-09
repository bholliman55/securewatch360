import { apiJson } from "../lib/apiFetch";

export interface Incident {
  incident_id: string;
  findingId?: string | null;
  client_id?: number;
  title: string;
  severity: string;
  status: string;
  category: string;
  description: string;
  affected_systems: string[];
  detected_at: string;
  occurred_at?: string;
  resolved_at: string | null;
  assigned_to: string;
  created_by?: string;
  impact: string;
  response_actions: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface IncidentMetrics {
  total: number;
  open: number;
  investigating: number;
  resolved: number;
  closed: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  avgResolutionTimeHours: number;
}

function requireTenant(tenantId: string | null | undefined): string {
  if (!tenantId || tenantId.trim() === "") {
    throw new Error("Select a tenant to load incidents.");
  }
  return tenantId;
}

type ApiIncident = {
  id: string;
  findingId?: string | null;
  title: string;
  description: string | null;
  state: string;
  createdAt: string;
};

function mapIncident(row: ApiIncident): Incident {
  return {
    incident_id: row.id,
    findingId: row.findingId ?? null,
    title: row.title,
    severity: "medium",
    status: row.state,
    category: "incident_response",
    description: row.description ?? "",
    affected_systems: [],
    detected_at: row.createdAt,
    resolved_at: null,
    assigned_to: "Unassigned",
    impact: "",
    response_actions: "",
    created_at: row.createdAt,
    updated_at: row.createdAt,
  };
}

export const incidentsService = {
  async getIncidents(tenantId?: string | null): Promise<Incident[]> {
    const tid = requireTenant(tenantId);
    const res = await apiJson<{ ok: boolean; incidents?: ApiIncident[] }>(
      `/api/incidents?tenantId=${encodeURIComponent(tid)}&limit=100`
    );
    return (res.incidents ?? []).map(mapIncident);
  },

  async getMetrics(tenantId?: string | null): Promise<IncidentMetrics> {
    const incidents = await this.getIncidents(tenantId);

    const statusCounts = incidents.reduce(
      (acc, incident) => {
        acc[incident.status] = (acc[incident.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const severityCounts = incidents.reduce(
      (acc, incident) => {
        acc[incident.severity] = (acc[incident.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const resolvedIncidents = incidents.filter((i) => i.status === "resolved" || i.status === "closed");
    const avgResolutionTime =
      resolvedIncidents.length > 0
        ? resolvedIncidents.reduce((sum, incident) => {
            const detected = new Date(incident.detected_at).getTime();
            const resolved = new Date(incident.resolved_at!).getTime();
            return sum + (resolved - detected);
          }, 0) /
          resolvedIncidents.length /
          (1000 * 60 * 60)
        : 0;

    return {
      total: incidents.length,
      open: statusCounts.open ?? 0,
      investigating: statusCounts.contained ?? 0,
      resolved:
        (statusCounts.remediated ?? 0) + (statusCounts.validated ?? 0) + (statusCounts.rejoined ?? 0),
      closed: 0,
      critical: severityCounts.critical || 0,
      high: severityCounts.high || 0,
      medium: severityCounts.medium || 0,
      low: severityCounts.low || 0,
      avgResolutionTimeHours: Number(avgResolutionTime.toFixed(1)),
    };
  },

  async createIncident(
    tenantId: string,
    body: { title: string; description?: string; findingId?: string | null }
  ): Promise<void> {
    await apiJson(`/api/incidents`, {
      method: "POST",
      body: JSON.stringify({
        tenantId,
        title: body.title,
        description: body.description ?? "",
        findingId: body.findingId ?? undefined,
      }),
    });
  },
};
