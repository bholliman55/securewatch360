import { apiJson } from "../lib/apiFetch";

export interface Ticket {
  ticket_id: string;
  connectwiseId?: number;
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
}

function requireTenant(tenantId: string | null | undefined): string {
  if (!tenantId || tenantId.trim() === "") {
    throw new Error("Select a tenant to work with tickets.");
  }
  return tenantId;
}

type ApiListRow = {
  ticketId: string;
  connectwiseId: number;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
};

class TicketsService {
  async getTickets(tenantId?: string | null): Promise<Ticket[]> {
    const tid = requireTenant(tenantId);
    const res = await apiJson<{ ok: boolean; tickets?: ApiListRow[] }>(
      `/api/integrations/connectwise/tickets?tenantId=${encodeURIComponent(tid)}&pageSize=30`
    );
    const now = new Date().toISOString();
    return (res.tickets ?? []).map((t) => ({
      ticket_id: t.ticketId,
      connectwiseId: t.connectwiseId,
      incident_id: null,
      client_id: 0,
      title: t.title,
      description: null,
      status: t.status,
      priority: t.priority,
      assigned_to: null,
      created_by: "ConnectWise",
      created_at: t.createdAt,
      updated_at: now,
    }));
  }

  async getTicketsByIncident(_incidentId: string): Promise<Ticket[]> {
    return [];
  }

  async createTicket(
    tenantId: string,
    input: {
      title: string;
      description: string;
      priority: string;
      status: string;
      assigned_to: string;
      incident_id: string | null;
    }
  ): Promise<Ticket> {
    const tid = requireTenant(tenantId);
    const res = await apiJson<{
      ok: boolean;
      ticket?: { connectwiseId: number; title: string; externalRef: string };
    }>("/api/integrations/connectwise/tickets", {
      method: "POST",
      body: JSON.stringify({
        tenantId: tid,
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: input.status,
        assignedTo: input.assigned_to,
        incidentId: input.incident_id,
      }),
    });
    const t = res.ticket;
    if (!t) {
      throw new Error("Invalid response from ticket API");
    }
    const now = new Date().toISOString();
    return {
      ticket_id: t.externalRef,
      connectwiseId: t.connectwiseId,
      incident_id: input.incident_id,
      client_id: 0,
      title: t.title,
      description: input.description,
      status: "open",
      priority: input.priority,
      assigned_to: input.assigned_to || null,
      created_by: "SecureWatch360",
      created_at: now,
      updated_at: now,
    };
  }

  async updateTicket(_ticketId: string, _updates: Partial<Ticket>): Promise<void> {
    /* no-op: ConnectWise updates are done in Manage */
  }

  async deleteTicket(_ticketId: string): Promise<void> {
    /* no-op */
  }
}

export const ticketsService = new TicketsService();
