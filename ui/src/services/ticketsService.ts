import { apiJson } from "../lib/apiFetch";

export interface Ticket {
  ticket_id: string;
  incident_id: string | null;
  client_id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  connectwiseId?: number;
}

function requireTenant(tenantId: string | null | undefined): string {
  if (!tenantId || tenantId.trim() === "") {
    throw new Error("Select a tenant to work with tickets.");
  }
  return tenantId;
}

type ApiListTicket = {
  ticketId: string;
  connectwiseId: number;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
};

function mapListTicket(t: ApiListTicket): Ticket {
  const at = t.createdAt || new Date().toISOString();
  return {
    ticket_id: t.ticketId,
    incident_id: null,
    client_id: 0,
    title: t.title,
    description: null,
    status: t.status,
    priority: t.priority,
    assigned_to: null,
    created_by: null,
    created_at: at,
    updated_at: at,
    connectwiseId: t.connectwiseId,
  };
}

export type CreateTicketInput = {
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  assigned_to?: string;
  incident_id?: string | null;
};

class TicketsService {
  async getTickets(tenantId?: string | null, pageSize: number = 20): Promise<Ticket[]> {
    const tid = requireTenant(tenantId);
    if (!Number.isInteger(pageSize) || pageSize < 1) {
      pageSize = 20;
    }
    if (pageSize > 100) {
      pageSize = 100;
    }
    const res = await apiJson<{ ok: boolean; tickets?: ApiListTicket[]; error?: string }>(
      `/api/integrations/connectwise/tickets?tenantId=${encodeURIComponent(tid)}&pageSize=${pageSize}`
    );
    return (res.tickets ?? []).map(mapListTicket);
  }

  /**
   * The ConnectWise list API does not filter by incident; this returns an empty
   * list until the server exposes that filter. Prefer listing all and linking in UI.
   */
  async getTicketsByIncident(_incidentId: string, _tenantId?: string | null): Promise<Ticket[]> {
    return [];
  }

  async createTicket(
    tenantId: string | null | undefined,
    data: CreateTicketInput
  ): Promise<Ticket> {
    const tid = requireTenant(tenantId);
    const title = typeof data.title === "string" ? data.title.trim() : "";
    if (title.length === 0) {
      throw new Error("Title is required.");
    }

    const res = await apiJson<{
      ok: boolean;
      ticket: {
        connectwiseId: number;
        title: string;
        externalRef: string;
      };
    }>("/api/integrations/connectwise/tickets", {
      method: "POST",
      body: JSON.stringify({
        tenantId: tid,
        title,
        description: data.description?.trim() ?? "",
        priority: data.priority?.trim() ?? "medium",
        status: data.status?.trim() ?? "open",
        assignedTo: data.assigned_to?.trim() ?? "",
        incidentId: data.incident_id?.trim() || undefined,
      }),
    });

    const now = new Date().toISOString();
    const t = res.ticket;
    return {
      ticket_id: t.externalRef,
      incident_id: data.incident_id ?? null,
      client_id: 0,
      title: t.title,
      description: data.description?.trim() ?? null,
      status: "open",
      priority: data.priority?.trim() ?? "medium",
      assigned_to: data.assigned_to?.trim() || null,
      created_by: null,
      created_at: now,
      updated_at: now,
      connectwiseId: t.connectwiseId,
    };
  }

  async updateTicket(_ticketId: string, _updates: Partial<Ticket>): Promise<void> {
    // ConnectWise updates not exposed on this BFF yet
  }

  async deleteTicket(_ticketId: string): Promise<void> {
    // Not supported via API
  }
}

export const ticketsService = new TicketsService();
